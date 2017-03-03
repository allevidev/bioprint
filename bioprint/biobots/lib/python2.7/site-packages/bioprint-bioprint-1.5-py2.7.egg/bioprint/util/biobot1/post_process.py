#!/usr/bin/env python

# WARNING: This script changes its input file in-place
# This is a Slic3r post-processing script to add
# M106 after E1.000 lines and M107, M126, M127 after each E peak.

# pseudocode
# when there is a clear change in extruder required
# stop extrusion
# move dual extruder stepper to a known angle in steps for "E1"
# move in X as much as the extruders are offset (direction!)
# move dual extruder stepper to a known angle in steps for "E2"
# start extrusion
# resume motion script


import boto3
import datetime
import time
import re
import requests
import json
from flask.ext.login import current_user

analytics = True
# biobots_url = 'http://data.biobots.io/'
biobots_url = 'http://data.biobots.io'

def connected_to_biobots(url='http://data.biobots.io/', timeout=5):
    try:
        _ = requests.get(url, timeout=timeout)
        return True
    except requests.ConnectionError:
        print("No internet connection available.")
    return False

# from bioprint.settings import settings

e_rate = 1000.00
x_rate = 2000.00

x_travel = 48.33

wellPlatePositions_old = {
    1: {
        "A": {
            0: {
                0: {
                    "X": 56,
                    "Y": 90
                },
                1: {
                    "X": 104.33,
                    "Y": 90
                }
            }
        }
    },
    24: {
        "A": {
            0: {
                0: {
                    "X": 11.20,
                    "Y": 63.00
                },
                1: {
                    "X": 59.53,
                    "Y": 63.00
                }
            },
            1: {
                0: {
                    "X": 30.5,
                    "Y": 63.00
                },
                1: {
                    "X": 78.83,
                    "Y": 63.00
                }
            },
            2: {
                0: {
                    "X": 49.8,
                    "Y": 63.00
                },
                1: {
                    "X": 98.13,
                    "Y": 63.00
                }
            },
            3: {
                0: {
                    "X": 69.1,
                    "Y": 63.00
                },
                1: {
                    "X": 117.43,
                    "Y": 63.00
                }
            },
            4: {
                0: {
                    "X": 88.4,
                    "Y": 63.00
                },
                1: {
                    "X": 136.73,
                    "Y": 63.00
                }
            },
            5: {
                0: {
                    "X": 107.7,
                    "Y": 63.00
                },
                1: {
                    "X": None,
                    "Y": None
                }
            },
        },
        "B": {
            0: {
                0: {
                    "X": 11.20,
                    "Y": 82.3
                },
                1: {
                    "X": 59.53,
                    "Y": 82.3
                }
            },
            1: {
                0: {
                    "X": 30.5,
                    "Y": 82.3
                },
                1: {
                    "X": 78.83,
                    "Y": 82.3
                }
            },
            2: {
                0: {
                    "X": 49.8,
                    "Y": 82.3
                },
                1: {
                    "X": 98.13,
                    "Y": 82.3
                }
            },
            3: {
                0: {
                    "X": 69.1,
                    "Y": 82.3
                },
                1: {
                    "X": 117.43,
                    "Y": 82.3
                }
            },
            4: {
                0: {
                    "X": 88.4,
                    "Y": 82.3
                },
                1: {
                    "X": 136.73,
                    "Y": 82.3
                }
            },
            5: {
                0: {
                    "X": 107.7,
                    "Y": 82.3
                },
                1: {
                    "X": None,
                    "Y": None
                }
            },
        },
        "C": {
            0: {
                0: {
                    "X": 11.20,
                    "Y": 101.6
                },
                1: {
                    "X": 59.53,
                    "Y": 101.6
                }
            },
            1: {
                0: {
                    "X": 30.5,
                    "Y": 101.6
                },
                1: {
                    "X": 78.83,
                    "Y": 101.6
                }
            },
            2: {
                0: {
                    "X": 49.8,
                    "Y": 101.6
                },
                1: {
                    "X": 98.13,
                    "Y": 101.6
                }
            },
            3: {
                0: {
                    "X": 69.1,
                    "Y": 101.6
                },
                1: {
                    "X": 117.43,
                    "Y": 101.6
                }
            },
            4: {
                0: {
                    "X": 88.4,
                    "Y": 101.6
                },
                1: {
                    "X": 136.73,
                    "Y": 101.6
                }
            },
            5: {
                0: {
                    "X": 107.7,
                    "Y": 101.6
                },
                1: {
                    "X": None,
                    "Y": None
                }
            },
        },
    }
}

e0_Xctr = 56
e0_Yctr = 90

e1_Xctr = 104.33
e1_Yctr = 90

mid = 22

x_pattern = 'X([+-]?\d+(?:\.\d+)?)'
y_pattern = 'Y([+-]?\d+(?:\.\d+)?)'
e_pattern = 'E([+-]?\d+(?:\.\d+)?)'
g_pattern = 'G([+-]?\d+(?:\.\d+)?)'
t_pattern = 'T(\d+\.\d+|\.\d+|\d+)'
z_pattern = 'Z([+-]?\d+(?:\.\d+)?)'
m_pattern = 'M([+-]?\d+(?:\.\d+)?)'
post_process_pattern = 'POST PROCESSED'

e0_pos = 24
e1_pos = 24


def e_value(line):
    '''
    Identify and returns the value of E on a line, for example
    returns 1.81780 for this line: "G1 X13.932 Y45.135 E1.81780"
    If no E found it return None
    '''
    if line.strip().startswith(';'):
        return None
    res = re.findall(e_pattern, line.upper())
    return None if res == [] else float(res[0])


def t_value(line):
    '''
    Identify and returns the value of E on a line, for example
    returns 1.81780 for this line: "G1 X13.932 Y45.135 E1.81780"
    If no E found it return None
    '''
    if line.strip().startswith(';'):
        return None
    res = re.findall(t_pattern, line.upper())
    return None if res == [] else float(res[0])


def g_value(line):
    '''
    Identify and returns the value of E on a line, for example
    returns 1.81780 for this line: "G1 X13.932 Y45.135 E1.81780"
    If no E found it return None
    '''
    if line.strip().startswith(';'):
        return None
    res = re.findall(g_pattern, line.upper())
    return None if res == [] else float(res[0])


def x_value(line):
    '''
    Identify and returns the value of X on a line, for example
    returns 1.81780 for this line "G1 X1.81780"
    If no X found it returns None
    '''
    if line.strip().startswith(';'):
        return None
    res = re.findall(x_pattern, line.upper())
    return None if res == [] else float(res[0])


def y_value(line):
    '''
    Identify and returns the value of Y on a line, for example
    returns 1.81780 for this line "G1 Y1.81780"
    If no Y found it returns None
    '''
    if line.strip().startswith(';'):
        return None
    res = re.findall(y_pattern, line.upper())
    return None if res == [] else float(res[0])


def remove_e(line):
    '''
    Remove the E value from a line, for example
    returns "G1 X13.932 Y45.135" on input "G1 X13.932 Y45.135 E1.81780"
    '''
    return ' '.join(filter(lambda x: x != '', [i.strip() if e_value(i) is None else ''.strip() for i in line.split(' ')]))


def g1_modify(line, x_offset, y_offset):
    '''
    Remove the E value from a line, for example
    returns "G1 X13.932 Y45.135" on input "G1 X13.932 Y45.135 E1.81780"
    '''
    command = []
    if x_offset is not None and y_offset is not None:
        for i in line.split(' '):
            if x_value(i) is not None:
                command.append('X' + str(x_value(i) + x_offset))
            elif y_value(i) is not None:
                command.append('Y' + str(y_value(i) + y_offset))
            elif z_value(i) is not None:
                next
                # command.append('Z' + str(z_value(i)))
            elif e_value(i) is not None:
                next
            else:
                command.append(i)
   # command.append('; X offset of ' + str(x_offset) + ' Y offset of ' + str(y_offset) + ' and Z offset of ' + str(z_offset) + ' added.')
    return ' '.join(command)


def z_value(line):
    '''
    Identify and returns the value of Z on a line, for example
    returns 1.81780 for this line "G1 Z1.81780"
    If no Z found it returns None
    '''
    if line.strip().startswith(';'):
        return None
    res = re.findall(z_pattern, line.upper())
    return None if res == [] else float(res[0])


def m_value(line):
    if line.strip().startswith(';'):
        return None
    res = re.findall(m_pattern, line.upper())
    return None if res == [] else float(res[0])    

def post_processed_check(line):
    if line.strip().startswith(';'):
        res = re.findall(post_process_pattern, line.upper())
        return False if res == [] else True


def start_extrude(extruder, e0_pos, e1_pos, z):
    if extruder is 0:
        onPin = 16
        target = e0_pos
    elif extruder is 1:
        onPin = 17
        target = e1_pos
    commands = [
        'G1 E' + str(target) + ' ; Move extruder to E' + str(extruder) + ' position of ' + str(target),
        'G1 Z' + str(z[extruder]),
        'M400 ; wait for commands to complete',
        'M42 P' + str(onPin) + ' S255 ; turn extruder ' + str(extruder) + ' on',
        'M400 ; wait for commands to complete']
    return '\n'.join(commands)


def stop_extrude(extruder):
    if extruder is 0:
        offPin = 16
        retractDir = -1
    elif extruder is 1:
        offPin = 17
        retractDir = 1
    commands = [
        'M400 ; wait for commands to complete',
        'M42 P' + str(offPin) + ' S0' 
        ' ; turn extruder ' + str(extruder) + ' off',
        'M400',
        'G90'] #,
        # 'G1 E' + str(mid) + ' F1000 ; Move extruder to mid point']
    return '\n'.join(commands)


def switch_extruder(extruder, e0_pos, e1_pos, e0_Xctr, e0_Yctr, e1_Xctr, e1_Yctr):
    if extruder is 0:
        onPin = 16
        offPin = 17
        direction = -1
        target = e0_pos
        x = e0_Xctr
        y = e0_Yctr
        z = 50
    elif extruder is 1:
        onPin = 17
        offPin = 16
        direction = 1
        target = e1_pos
        x = e1_Xctr
        y = e1_Yctr
        z = 50

    commands = [
        'T0 ; ensure we keep T0 active to prevent changing pressure',
        'M400 ; wait for commands to complete',
        'G1 E' + str(mid) + ' F' + str(e_rate) +
        ' ; move extruder to midpoint',
        'M400 ; wait for commands to complete',
        'G1 Z' + str(z)
        ]

    return '\n'.join(commands)

def crosslink(cl_x, cl_y, target_x, target_y, z, wellplate, cl_duration, cl_intensity):
    cl_z = {
        1: 0,
        6: 10,
        12: 10,
        24: 10,
        96: 10
    }
    commands = [
        'G1 Z50 F1000',
        'G1 E' + str(mid),
        'G1 X' + str(cl_x) + ' Y' + str(cl_y),
        'G1 Z' + str(cl_z[wellplate] + z[1]),
        'G1 E' + str(0),
        'M400',
        'M42 P4 S' + str(cl_intensity) + ' ; CROSSLINK HERE',
        'G4 P' + str(cl_duration),
        'M42 P4 S0',
        'G1 Z50 F1000',
        'G1 E' + str(mid),
        'G1 X' + str(target_x) + ' Y' + str(target_y),
        'G1 Z' + str(z[1])
    ]

    return '\n'.join(commands)

def calculate_wellplate_positions(positions):
    petri = {
        "A": {
            0: {
                0: {
                    "X": float(positions["tool0"]["X"]),
                    "Y": float(positions["tool0"]["Y"]),
                    "Z": float(positions["tool0"]["Z"])
                },
                1: {
                    "X": float(positions["tool1"]["X"]),
                    "Y": float(positions["tool1"]["Y"]),
                    "Z": float(positions["tool1"]["Z"])
                }
            }
        }
    }
    row_6 = ["A", "B"]
    column_6 = 3
    out_6 = {}
    for i in xrange(len(row_6)):
        row_out = {}
        for j in xrange(column_6):
            row_out[j] = {
                0: {
                    "X": float(positions["tool0"]["X"]) + j * 39.12,
                    "Y": float(positions["tool0"]["Y"]) + i * 39.12,
                    "Z": float(positions["tool0"]["Z"])
                },
                1: {
                    "X": float(positions["tool1"]["X"]) + j * 39.12,
                    "Y": float(positions["tool1"]["Y"]) + i * 39.12,
                    "Z": float(positions["tool1"]["Z"])
                }
            }
        out_6[row_6[i]] = row_out
    row_12 = ["A", "B", "C"]
    column_12 = 4
    out_12 = {}
    for i in xrange(len(row_12)):
        row_out = {}
        for j in xrange(column_12):
            row_out[j] = {
                0: {
                    "X": float(positions["tool0"]["X"]) + j * 26.01,
                    "Y": float(positions["tool0"]["Y"]) + i * 26.01,
                    "Z": float(positions["tool0"]["Z"])
                },
                1: {
                    "X": float(positions["tool1"]["X"]) + j * 26.01,
                    "Y": float(positions["tool1"]["Y"]) + i * 26.01,
                    "Z": float(positions["tool1"]["Z"])
                }
            }
        out_12[row_12[i]] = row_out
    row_24 = ["A", "B", "C", "D"]
    column_24 = 6
    out_24 = {}
    for i in xrange(len(row_24)):
        row_out = {}
        for j in xrange(column_24):
            row_out[j] = {
                0: {
                    "X": float(positions["tool0"]["X"]) + j * 19.3,
                    "Y": float(positions["tool0"]["Y"]) + i * 19.3,
                    "Z": float(positions["tool0"]["Z"])
                },
                1: {
                    "X": float(positions["tool1"]["X"]) + j * 19.3,
                    "Y": float(positions["tool1"]["Y"]) + i * 19.3,
                    "Z": float(positions["tool1"]["Z"])
                }
            }
        out_24[row_24[i]] = row_out
    row_96 = ["A", "B", "C", "D", "E", "F"]
    column_96 = 12
    out_96 = {}
    for i in xrange(len(row_96)):
        row_out = {}
        for j in xrange(column_96):
            row_out[j] = {
                0: {
                    "X": float(positions["tool0"]["X"]) + j * 9,
                    "Y": float(positions["tool0"]["Y"]) + i * 9,
                    "Z": float(positions["tool0"]["Z"])
                },
                1: {
                    "X": float(positions["tool1"]["X"]) + j * 9,
                    "Y": float(positions["tool1"]["Y"]) + i * 9,
                    "Z": float(positions["tool1"]["Z"])
                }
            }
        out_96[row_96[i]] = row_out

    return {
        1: petri,
        6: out_6,
        12: out_12,
        24: out_24,
        96: out_96
    }

def end_print():
    x_end_pos = 0
    y_end_pos = 0
    e_end_pos = 0
    z_end_pos = 50
    commands = [
        'M42 P16 S0',
        'M42 P17 S0',
        'G1 Z' + str(z_end_pos) + ' F1000',
        'G1 E' + str(e_end_pos) + ' F1000',
        'G1 X' + str(x_end_pos) + ' Y' + str(y_end_pos) + ' F1000'
    ]
    return '\n'.join(commands)

def post_process(payload, positions, wellPlate, cl_params, tempData):
    '''
    Read a gcode file and add M106 after E1.000 lines and
    M107, M126, M127 after each E peak.
    '''
    
    processed = False

    with open(payload["file"], 'r') as f:
        for i, line in enumerate(f):
            if post_processed_check(line) == True:
                processed = True
                return payload

    e0_pos = 46
    e1_pos = 0
    filename = str(payload["file"])

    fName = '.'.join(str.split(filename, '.')[0:-1])
    fType = str.split(filename, '.')[-1]
    timeformat = '%Y-%m-%d-%H-%M-%S'
    timestamp = datetime.datetime.fromtimestamp(time.time()).strftime(timeformat)
    inputFileName = '.'.join(str.split(str.split(filename, '/')[-1], '.')[0:-1]) + '.' + fType
    
    if processed == True:
        outputFileName = inputFileName + timestamp + '.' + fType
        outputFile = fName + timestamp + '.' + fType    
    elif processed == False:
        outputFileName = inputFileName + '_processed_' + timestamp + '.' + fType
        outputFile = fName + '_processed_' + timestamp + '.' + fType


    if processed == False:
        wellPlatePositions = calculate_wellplate_positions(positions)
        rows = sorted(wellPlatePositions[wellPlate].keys())


        with open(outputFile, 'w') as o:
            o.write('; POST PROCESSED\n')
            active_e = 0
            last_e = 0
            extruding = False
            layer_z = [positions["tool0"]["Z"],positions["tool1"]["Z"]]
            for r in rows:
                columns = sorted(wellPlatePositions[wellPlate][r].keys())
                for c in columns:
                    layer = 0

                    e0_Xctr = wellPlatePositions[wellPlate][r][c][0]["X"]
                    e0_Yctr = wellPlatePositions[wellPlate][r][c][0]["Y"]
                    e0_Z = wellPlatePositions[wellPlate][r][c][0]["Z"]

                    e1_Xctr = wellPlatePositions[wellPlate][r][c][1]["X"]
                    e1_Yctr = wellPlatePositions[wellPlate][r][c][1]["Y"]
                    e1_Z = wellPlatePositions[wellPlate][r][c][1]["Z"]
                    x_pos, x_pos_old = [e0_Xctr, e1_Xctr], [e0_Xctr, e1_Xctr]
                    y_pos, y_pos_old = [e0_Yctr, e1_Yctr], [e0_Yctr, e1_Yctr]
                    with open(filename, 'r') as f:
                        o.write('G1 Z50\n')
                        o.write('G1 E' + str(mid) + '\n')
                        o.write('G21\n')
                        o.write('G1 X' + str(e0_Xctr) + ' Y' + str(e0_Yctr) + ' F1000\n')
                        for i, line in enumerate(f):
                            if z_value(line) is not None:
                                o.write(stop_extrude(active_e) + '\n')
                                last_e = 0
                                extruding = False
                                if cl_params["cl_layers_enabled"]:
                                    if layer % cl_params["cl_layers"] == 0 and layer != 0:
                                        if active_e == 0:
                                            target_x = e0_Xctr
                                            target_y = e0_Yctr
                                        elif active_e == 1:
                                            target_x = e1_Xctr
                                            target_y = e1_Yctr
                                        o.write(crosslink(e1_Xctr, e1_Yctr, target_x, target_y, layer_z, wellPlate, cl_params["cl_duration"], cl_params["cl_intensity"]) + '\n')
                                
                                layer_z[0] = z_value(line) + e0_Z
                                layer_z[1] = z_value(line) + e1_Z
                                layer += 1
                                next
                            if m_value(line) == 190.0 or m_value(line) == 104.0 or m_value(line) == 109.0:
                                next
                            else:
                                if x_value(line) is not None:
                                    x_pos_old[active_e] = x_pos[active_e]
                                    if active_e == 0:
                                        x_pos[active_e] = x_value(line) + e0_Xctr    
                                    elif active_e == 1:
                                        x_pos[active_e] = x_value(line) + e1_Xctr
                                if y_value(line) is not None:
                                    y_pos_old[active_e] = y_pos[active_e]
                                    if active_e == 0:
                                        y_pos[active_e] = y_value(line) + e0_Yctr    
                                    elif active_e == 1:
                                        y_pos[active_e] = y_value(line) + e1_Yctr
                                if g_value(line) is not None:
                                    if g_value(line) == 28.0:
                                        next
                                    elif g_value(line) == 1 or e_value(line) is not None:
                                        if e_value(line) is not None:
                                            d_e = e_value(line) - last_e
                                            if d_e > 0:
                                                o.write('G1 X' + str(x_pos_old[active_e]) + ' Y' + str(y_pos_old[active_e]) + '\n')
                                                if not extruding:
                                                    o.write(start_extrude(active_e, e0_pos, e1_pos, layer_z) + '\n')
                                                    extruding = True
                                                if active_e == 0:
                                                    o.write(g1_modify(line, e0_Xctr, e0_Yctr) + '\n')
                                                elif active_e == 1:
                                                    o.write(g1_modify(line, e1_Xctr, e1_Yctr) + '\n')
                                                last_e = e_value(line)
                                                next
                                            elif d_e < 0:
                                                if active_e == 0:
                                                    o.write(g1_modify(line, e0_Xctr, e0_Yctr) + '\n')
                                                elif active_e == 1:
                                                    o.write(g1_modify(line, e1_Xctr, e1_Yctr) + '\n')
                                                if extruding:
                                                    o.write(stop_extrude(active_e) + '\n')   
                                                    extruding = False
                                                last_e = e_value(line)
                                                next
                                        elif g_value(line) == 1:
                                            if e_value(line) is None and last_e > 0:
                                                if extruding:
                                                    o.write(stop_extrude(active_e) + '\n')   
                                                    extruding = not extruding
                                                last_e = 0
                                                if active_e == 0:
                                                    o.write(g1_modify(line, e0_Xctr, e0_Yctr) + '\n')
                                                elif active_e == 1:
                                                    o.write(g1_modify(line, e1_Xctr, e1_Yctr) + '\n')
                                                next
                                            else:
                                                if active_e == 0:
                                                    o.write(g1_modify(line, e0_Xctr, e0_Yctr) + '\n')
                                                elif active_e == 1:
                                                    o.write(g1_modify(line, e1_Xctr, e1_Yctr) + '\n')
                                    else:
                                        o.write(line)
                                elif line.startswith('T') and t_value(line) is not None:
                                    active_e = int(t_value(line))
                                    o.write(switch_extruder(active_e, e0_pos, e1_pos, e0_Xctr, e0_Yctr, e1_Xctr, e1_Yctr) + '\n')
                                elif m_value(line) == 106.0:
                                    o.write(start_extrude(active_e, e0_pos, e1_pos, layer_z) + '\n')
                                elif m_value(line) == 107.0:
                                    o.write(stop_extrude(active_e) + '\n')
                                else:
                                    o.write(line)
                        if cl_params["cl_end"]:
                            o.write(stop_extrude(active_e) + '\n')
                            if active_e == 0:
                                target_x = e0_Xctr
                                target_y = e0_Yctr
                            elif active_e == 1:
                                target_x = e1_Xctr
                                target_y = e1_Yctr
                            o.write(crosslink(e1_Xctr, e1_Yctr, target_x, target_y, layer_z, wellPlate, cl_params["cl_end_duration"], cl_params["cl_end_intensity"])+ '\n')
                    f.close()
            o.write(end_print() + '\n')
        o.close()

    if analytics:
        if connected_to_biobots() and current_user:
            user_info = {
                'email': current_user.get_email(),
                'serial': current_user.get_serial()
            }

            permission = requests.post(biobots_url+'/permission', json=user_info)
            
            credentials = json.loads(permission.text)["Credentials"]
            
            s3 = boto3.resource('s3', aws_access_key_id=credentials["AccessKeyId"], aws_secret_access_key=credentials["SecretAccessKey"], aws_session_token=credentials["SessionToken"])
            folder = user_info['email'] + '/' + str(user_info['serial']) + '/' + timestamp + '/'
            inputObject = s3.Object('biobots-analytics', folder + inputFileName);
            inputObject.put(ACL='public-read', Body=open(filename, 'rb'))
            outputObject = s3.Object('biobots-analytics', folder + outputFileName);
            outputObject.put(ACL='public-read', Body=open(outputFile, 'rb'))
            if processed == True:
                tool0 = {
                    "temperature": {
                        "actual": tempData['tool0']['actual'] if tempData['tool0'] else 0,
                        "target": tempData['tool0']['target'] if tempData['tool0'] else 0
                    },
                    "pressure": tempData['bed']['actual'] if 'bed' in tempData.keys() else 0,
                    "X": "",
                    "Y": "",
                    "Z": "",
                    "E": e0_pos
                }
                tool1 = {
                    "temperature": {
                        "actual": tempData['tool1']['actual'] if tempData['tool1'] else 0,
                        "target": tempData['tool1']['target'] if tempData['tool1'] else 0
                    },
                    "pressure": tempData['tool2']['actual'] if 'tool2' in tempData.keys() else 0,
                    "X": "",
                    "Y": "",
                    "Z": "",
                    "E": e1_pos
                }
            elif processed == False:
                tool0 = {
                    "temperature": {
                        "actual": tempData['tool0']['actual'] if tempData['tool0'] else 0,
                        "target": tempData['tool0']['target'] if tempData['tool0'] else 0
                    },
                    "pressure": tempData['bed']['actual'] if 'bed' in tempData.keys() else 0,
                    "X": positions["tool0"]["X"],
                    "Y": positions["tool0"]["Y"],
                    "Z": positions["tool0"]["Z"],
                    "E": e0_pos
                }
                tool1 = {
                    "temperature": {
                        "actual": tempData['tool1']['actual'] if tempData['tool1'] else 0,
                        "target": tempData['tool1']['target'] if tempData['tool1'] else 0
                    },
                    "pressure": tempData['tool2']['actual'] if 'tool2' in tempData.keys() else 0,
                    "X": positions["tool1"]["X"],
                    "Y": positions["tool1"]["Y"],
                    "Z": positions["tool1"]["Z"],
                    "E": e1_pos
                }

            print_info = {
                'input': inputObject.key,
                'output': outputObject.key,
                'tool0': tool0,
                'tool1': tool1,
                'positions': positions,
                'wellPlate': wellPlate,
                'cl_params': cl_params
            }

            print print_info

            data = {
                'user_info': user_info,
                'print_info': print_info
            };
            requests.post(biobots_url+'/analytics', json=data).text;
    if processed == True:
        return payload
    else:
        return {
            "file": outputFile,
            "filename": payload["filename"],
            "origin": payload["origin"]
        }

test_payload = {
    'origin': 'local', 
    'file': 'test_files/test_lattice.gcode',
    'filename': u'test_files/test_lattice.gcode'
}

test_positions = {
    "tool0": {
        "X": 11.20,
        "Y": 63,
        "Z": 16
    },
    "tool1": {
        "X": 59.53,
        "Y": 63,
        "Z": 13
    },
}

cl_params = {
    "cl_layers_enabled": True,
    "cl_layers": 1,
    "cl_duration": 2000,
    "cl_intensity": 25,
    "cl_end": True,
    "cl_end_duration": 2000,
    "cl_end_intensity": 100
}

# post_process(test_payload, test_positions, 1, cl_params, None)
# print calculate_wellplate_positions(test_positions, 24)

