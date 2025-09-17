#!/usr/bin/env python3

import re

# Read the file
with open('src/japanese_types.rs', 'r') as f:
    content = f.read()

# Define patterns that need serde rename attributes
# These are uppercase enum variants that should be lowercase in JSON
patterns_to_fix = [
    ('Adv,', '#[serde(rename = "adv")]\n    Adv,'),
    ('Aux,', '#[serde(rename = "aux")]\n    Aux,'),
    ('Conj,', '#[serde(rename = "conj")]\n    Conj,'),
    ('Cop,', '#[serde(rename = "cop")]\n    Cop,'),
    ('Ctr,', '#[serde(rename = "ctr")]\n    Ctr,'),
    ('Exp,', '#[serde(rename = "exp")]\n    Exp,'),
    ('Int,', '#[serde(rename = "int")]\n    Int,'),
    ('N,', '#[serde(rename = "n")]\n    N,'),
    ('Num,', '#[serde(rename = "num")]\n    Num,'),
    ('Pn,', '#[serde(rename = "pn")]\n    Pn,'),
    ('Pref,', '#[serde(rename = "pref")]\n    Pref,'),
    ('Prt,', '#[serde(rename = "prt")]\n    Prt,'),
    ('Suf,', '#[serde(rename = "suf")]\n    Suf,'),
    ('V1,', '#[serde(rename = "v1")]\n    V1,'),
    ('V4B,', '#[serde(rename = "v4b")]\n    V4B,'),
    ('V4G,', '#[serde(rename = "v4g")]\n    V4G,'),
    ('V4H,', '#[serde(rename = "v4h")]\n    V4H,'),
    ('V4K,', '#[serde(rename = "v4k")]\n    V4K,'),
    ('V4M,', '#[serde(rename = "v4m")]\n    V4M,'),
    ('V4R,', '#[serde(rename = "v4r")]\n    V4R,'),
    ('V4S,', '#[serde(rename = "v4s")]\n    V4S,'),
    ('V4T,', '#[serde(rename = "v4t")]\n    V4T,'),
    ('V5Aru,', '#[serde(rename = "v5aru")]\n    V5Aru,'),
    ('V5B,', '#[serde(rename = "v5b")]\n    V5B,'),
    ('V5G,', '#[serde(rename = "v5g")]\n    V5G,'),
    ('V5K,', '#[serde(rename = "v5k")]\n    V5K,'),
    ('V5M,', '#[serde(rename = "v5m")]\n    V5M,'),
    ('V5N,', '#[serde(rename = "v5n")]\n    V5N,'),
    ('V5R,', '#[serde(rename = "v5r")]\n    V5R,'),
    ('V5S,', '#[serde(rename = "v5s")]\n    V5S,'),
    ('V5T,', '#[serde(rename = "v5t")]\n    V5T,'),
    ('Vi,', '#[serde(rename = "vi")]\n    Vi,'),
    ('Vk,', '#[serde(rename = "vk")]\n    Vk,'),
    ('Vn,', '#[serde(rename = "vn")]\n    Vn,'),
    ('Vr,', '#[serde(rename = "vr")]\n    Vr,'),
    ('Vs,', '#[serde(rename = "vs")]\n    Vs,'),
    ('Vt,', '#[serde(rename = "vt")]\n    Vt,'),
    ('Vz,', '#[serde(rename = "vz")]\n    Vz,'),
]

# Apply fixes
for old, new in patterns_to_fix:
    # Only replace if it doesn't already have a serde rename attribute
    pattern = f'    {old}'
    if pattern in content and f'#[serde(rename' not in content[content.find(pattern)-50:content.find(pattern)]:
        content = content.replace(f'    {old}', f'    {new}')

# Write the file back
with open('src/japanese_types.rs', 'w') as f:
    f.write(content)

print("Fixed Japanese types with serde rename attributes")
