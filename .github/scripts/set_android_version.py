#!/usr/bin/env python3
import re,sys
from pathlib import Path
v=sys.argv[1]
match=re.fullmatch(r'(\d+)\.(\d+)\.(\d+)',v)
if not match: raise SystemExit('Invalid version, expected N.N.N')
a,b,c=map(int,match.groups())
if not (0 <= a <= 100 and 0 <= b < 1000 and 0 <= c < 1000): raise SystemExit('Version segment too large')
code=a*1_000_000+b*1000+c
p=Path('capacitor/android/app/build.gradle')
s=p.read_text()
s,n=re.subn(r'(?m)^(\s*)versionCode\s+\d+\s*$',lambda m:m.group(1)+f'versionCode {code}',s,count=1)
if n!=1: raise SystemExit('versionCode not found in app/build.gradle')
s,n=re.subn(r'(?m)^(\s*)versionName\s+"[^"]+"\s*$',lambda m:m.group(1)+f'versionName "{v}"',s,count=1)
if n!=1: raise SystemExit('versionName not found in app/build.gradle')
p.write_text(s)
print('Android release',v,'code',code)
