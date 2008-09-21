#!/bin/bash

#/* ***** BEGIN LICENSE BLOCK *****
# * Version: MPL 1.1/GPL 2.0/LGPL 2.1
# *
# * The contents of this file are subject to the Mozilla Public License Version
# * 1.1 (the "License"); you may not use this file except in compliance with
# * the License. You may obtain a copy of the License at
# * http://www.mozilla.org/MPL/
# *
# * Software distributed under the License is distributed on an "AS IS" basis,
# * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# * for the specific language governing rights and limitations under the
# * License.
# *
# * The Original Code is a script for building Firefox and running fuzzers.
# *
# * The Initial Developer of the Original Code is
# * Gary Kwong.
# * Portions created by the Initial Developer are Copyright (C) 2006-2008
# * the Initial Developer. All Rights Reserved.
# *
# * Contributor(s):
# *
# * Alternatively, the contents of this file may be used under the terms of
# * either the GNU General Public License Version 2 or later (the "GPL"), or
# * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# * in which case the provisions of the GPL or the LGPL are applicable instead
# * of those above. If you wish to allow use of your version of this file only
# * under the terms of either the GPL or the LGPL, and not to allow others to
# * use your version of this file under the terms of the MPL, indicate your
# * decision by deleting the provisions above and replace them with the notice
# * and other provisions required by the GPL or the LGPL. If you do not delete
# * the provisions above, a recipient may use your version of this file under
# * the terms of any one of the MPL, the GPL or the LGPL.
# *
# * ***** END LICENSE BLOCK ***** */

# Version History:
# 
# June 2008 - 1:
#     Adapted from moz-190 CVS trunk for dom script.

# FAQ:
# 1: If something screws up, trash the entire existing ~/Desktop/dom-debug-fx-trunk-A folder.
# 2: To clone this script, replace "dom-debug-fx-trunk-A" throughout this script with "dom-debug-fx-trunk-B", "dom-debug-fx-trunk-C" and so on.
# 4: File naming convention is:
#        dom-<opt/debug>-<app>-<branch/trunk>-compileOnly

date
echo
echo 'This script assumes that you have an up-to-date mozilla-central directory at ~/mozilla-central/'
echo
echo 'Starting in 7s...'
sleep 7
echo
date
mkdir -p ~/Desktop/dom-debug-fx-trunk-A  #  This will overwrite your existing directory's files.
cd ~/Desktop/dom-debug-fx-trunk-A


# Compile a debug fx build.

mkdir -p fx-trunk-hg-debug  #  This will overwrite your existing directory's files.
cd fx-trunk-hg-debug
cp -R ~/mozilla-central/ .
cp ~/fuzzing/dom/automation/mozconfig-debug-fx ~/Desktop/dom-debug-fx-trunk-A/fx-trunk-hg-debug/.mozconfig
date
time make -f client.mk build MOZ_CURRENT_PROJECT=browser


# Start fuzzing the newly compiled debug fx build.

date
echo
echo 'Done compiling!'
echo
cat ~/fuzzing/dom/automation/how-to-use.txt
echo
echo '~/fuzzing/dom/automation/how-to-use.txt - your build is located at ~/Desktop/dom-debug-fx-trunk-A/objdir/browser/dist/MinefieldDebug.app/Contents/MacOS/firefox-bin -P fuzz1-moz190'
echo
cd ~/Desktop/dom-debug-fx-trunk-A/fx-trunk-hg-debug/objdir/browser/dist/MinefieldDebug.app/Contents/MacOS/
pwd
echo
#cd ~/Desktop/dom-debug-fx-trunk-A
#time python -u ~/fuzzing/jsfunfuzz/multi_timed_run.py 900 ~/Desktop/jsfunfuzz-moz190-A/js-moz190-intelmac ~/fuzzing/jsfunfuzz/jsfunfuzz.js | tee ~/Desktop/jsfunfuzz-moz190-A/log-jsfunfuzz
#date
