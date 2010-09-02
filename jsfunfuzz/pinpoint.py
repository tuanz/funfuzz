#!/usr/bin/env python

import os
import subprocess

from fnStartjsfunfuzz import archOfBinary

p0=os.path.dirname(__file__)
lithiumpy = os.path.abspath(os.path.join(p0, "..", "lithium", "lithium.py"))
autobisectpy = os.path.abspath(os.path.join(p0, "..", "js-autobisect", "autoBisect.py"))

def pinpoint(itest, logPrefix, jsEngine, engineFlags, infilename, alsoRunChar=True):
    """
       Run Lithium and autobisect.

       itest must be an array of the form [module, ...] where module is an interestingness module.
       The module's "interesting" function must accept [...] + [jsEngine] + engineFlags + infilename
       (If it's not prepared to accept engineFlags, engineFlags must be empty.)
    """

    lith1tmp = logPrefix + "-lith1-tmp"
    os.mkdir(lith1tmp)
    lithArgs = itest + [jsEngine] + engineFlags + [infilename]
    print ' '.join([lithiumpy] + lithArgs)
    subprocess.call(["python", lithiumpy, "--tempdir=" + lith1tmp] + lithArgs, stdout=open(logPrefix + "-lith1-out", "w"))

    if alsoRunChar:
        lith2tmp = logPrefix + "-lith2-tmp"
        os.mkdir(lith2tmp)
        lithArgs = ["--char"] + lithArgs
        print ' '.join([lithiumpy] + lithArgs)
        subprocess.call(["python", lithiumpy, "--tempdir=" + lith2tmp] + lithArgs, stdout=open(logPrefix + "-lith2-out", "w"))

    print "Done running Lithium"

    autobisectCmd = ["python", autobisectpy, "-i", "-p", "-a", archOfBinary(jsEngine)] + engineFlags + [infilename] + itest
    print ' '.join(autobisectCmd)
    subprocess.call(autobisectCmd, stdout=open(logPrefix + "-autobisect", "w"), stderr=subprocess.STDOUT)

    print "Done running autobisect"
