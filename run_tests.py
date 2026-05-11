#!/usr/bin/env python3
"""
Comprehensive test runner for mine-management-system.
Runs all tests with coverage and generates a report.
"""

import sys
import subprocess
import argparse
from pathlib import Path


def run_command(cmd, description):
    """Run a command and print results."""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {cmd}")
    print('='*60)
    
    result = subprocess.run(cmd, shell=True, capture_output=False, text=True)
    return result.returncode


def main():
    parser = argparse.ArgumentParser(
        description='Run tests for mine-management-system',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_tests.py              # Run all tests
  python run_tests.py -q           # Run quietly (summary only)
  python run_tests.py --fast      # Skip load tests (faster)
  python run_tests.py --unit       # Run only unit tests
  python run_tests.py --coverage   # Run with coverage report
  python run_tests.py test_admin   # Run specific test file
        """
    )
    
    parser.add_argument(
        '-q', '--quiet',
        action='store_true',
        help='Run quietly, show summary only'
    )
    
    parser.add_argument(
        '--fast',
        action='store_true',
        help='Skip load/stress tests (faster execution)'
    )
    
    parser.add_argument(
        '--unit',
        action='store_true',
        help='Run only unit tests (no integration tests)'
    )
    
    parser.add_argument(
        '--coverage',
        action='store_true',
        help='Generate coverage report'
    )
    
    parser.add_argument(
        'test_pattern',
        nargs='?',
        help='Run specific test file (e.g., test_admin)'
    )
    
    args = parser.parse_args()
    
    # Check if we're in the right directory
    if not Path('app.py').exists():
        print("Error: Must run from project root directory (where app.py is located)")
        sys.exit(1)
    
    # Install dependencies if needed
    print("Checking test dependencies...")
    try:
        import pytest
        import pytest_flask
    except ImportError:
        print("Installing test dependencies...")
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', 'test_requirements.txt'],
                      check=True)
    
    # Build pytest command
    pytest_args = ['-v'] if not args.quiet else ['-q']
    
    if args.coverage:
        pytest_args.extend(['--cov=app', '--cov-report=term-missing'])
    
    # Determine which tests to run
    if args.test_pattern:
        test_path = f"tests/{args.test_pattern}.py"
        if not Path(test_path).exists():
            # Try without .py extension
            test_path = f"tests/{args.test_pattern}"
        pytest_args.append(test_path)
    else:
        # Run all tests
        ignore_patterns = []
        
        if args.fast:
            # Skip load tests for faster execution
            ignore_patterns.append('--ignore=tests/test_load.py')
            print("Note: Skipping load tests (--fast mode)")
        
        if args.unit:
            # Skip integration and load tests
            ignore_patterns.extend([
                '--ignore=tests/test_load.py',
                '--ignore=tests/test_qr_scan.py'  # Hardware integration
            ])
            print("Note: Running unit tests only")
        
        pytest_args.extend(ignore_patterns)
        pytest_args.append('tests/')
    
    # Run tests
    cmd = f"{sys.executable} -m pytest {' '.join(pytest_args)}"
    exit_code = run_command(cmd, "Test Suite")
    
    # Summary
    print(f"\n{'='*60}")
    if exit_code == 0:
        print("✅ All tests passed!")
    else:
        print(f"❌ Tests failed with exit code {exit_code}")
    print('='*60)
    
    return exit_code


if __name__ == '__main__':
    sys.exit(main())
