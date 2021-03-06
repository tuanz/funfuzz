# coding=utf-8
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at https://mozilla.org/MPL/2.0/.

"""Test the sm_compile_helpers.py file."""

import logging
from pathlib import Path
import tempfile
import unittest

from funfuzz import util

FUNFUZZ_TEST_LOG = logging.getLogger("funfuzz_test")
logging.basicConfig(level=logging.DEBUG)
logging.getLogger("flake8").setLevel(logging.WARNING)


class SmCompileHelpersTests(unittest.TestCase):
    """"TestCase class for functions in sm_compile_helpers.py"""
    @staticmethod
    def test_autoconf_run():
        """Test the autoconf runs properly."""
        with tempfile.TemporaryDirectory(suffix="autoconf_run_test") as tmp_dir:
            tmp_dir = Path(tmp_dir)

            # configure.in is required by autoconf2.13
            (tmp_dir / "configure.in").touch()  # pylint: disable=no-member
            util.sm_compile_helpers.autoconf_run(tmp_dir)

    @staticmethod
    def test_ensure_cache_dir():
        """Test the shell-cache dir is created properly if it does not exist, and things work even though it does."""
        assert util.sm_compile_helpers.ensure_cache_dir(None).is_dir()
        assert util.sm_compile_helpers.ensure_cache_dir(Path.home()).is_dir()  # pylint: disable=no-member
