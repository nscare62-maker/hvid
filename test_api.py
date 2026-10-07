"""
HVID API Test Suite
Tests all major API endpoints to ensure they're working correctly
"""
import requests
import json
import sys

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:3000"
TEST_PHONE = "+919962106567"
TEST_OTP = "123456"
captured_otp = None

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_success(message):
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")

def print_error(message):
    print(f"{Colors.RED}✗ {message}{Colors.END}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ {message}{Colors.END}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠ {message}{Colors.END}")

def test_health():
    """Test health endpoint"""
    print("\n" + "="*60)
    print("Testing: Health Check")
    print("="*60)
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print_success(f"Health check passed: {data['message']}")
            return True
        else:
            print_error(f"Health check failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print_error("Cannot connect to server. Is it running?")
        print_info(f"Make sure the server is running on {BASE_URL}")
        return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_request_otp():
    """Test OTP request"""
    print("\n" + "="*60)
    print("Testing: Request OTP")
    print("="*60)
    global captured_otp
    try:
        payload = {"phone": TEST_PHONE}
        response = requests.post(
            f"{BASE_URL}/api/auth/request-otp",
            json=payload,
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            if data.get('dev_otp'):
                captured_otp = data.get('dev_otp')
            print_success(f"OTP requested: {data['message']}")
            print_info(f"Purpose: {data['purpose']}")
            return True
        else:
            print_error(f"Request failed: {response.status_code}")
            print_error(response.text)
            return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_verify_otp():
    """Test OTP verification and get token"""
    print("\n" + "="*60)
    print("Testing: Verify OTP")
    print("="*60)
    try:
        payload = {
            "phone": TEST_PHONE,
            "otp": captured_otp or TEST_OTP
        }
        response = requests.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json=payload,
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            print_success("OTP verified successfully")
            print_info(f"Identity ID: {data['identity_id']}")
            print_info(f"Verification Level: {data['verification_level']}")
            print_info(f"Is New: {data['is_new']}")
            return data['token'], data['identity_id']
        else:
            print_error(f"Verification failed: {response.status_code}")
            print_error(response.text)
            return None, None
    except Exception as e:
        print_error(f"Error: {e}")
        return None, None

def test_get_me(token):
    """Test get current user endpoint"""
    print("\n" + "="*60)
    print("Testing: Get Current User (/api/auth/me)")
    print("="*60)
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=headers,
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            print_success("User data retrieved")
            print_info(f"Username: {data.get('username', 'Not set')}")
            print_info(f"Phone Last4: {data['phone_last4']}")
            print_info(f"Identity State: {data['identity_state']}")
            print_info(f"Trust Signal: {data['trust_signal']}")
            print_info(f"Tier: {data['tier']}")
            return True
        else:
            print_error(f"Request failed: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_match_check():
    """Test identity matching"""
    print("\n" + "="*60)
    print("Testing: Identity Match Check")
    print("="*60)
    try:
        payload = {
            "type": "phone",
            "value": TEST_PHONE
        }
        response = requests.post(
            f"{BASE_URL}/api/match/check",
            json=payload,
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            print_success("Match check completed")
            print_info(f"Result Type: {data['result_type']}")
            print_info(f"Signal: {data['signal']}")
            print_info(f"Verification Level: {data['verification_level']}")
            if data.get('identity_id'):
                print_info(f"Identity ID: {data['identity_id']}")
            return True
        else:
            print_error(f"Request failed: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_get_identity(identity_id):
    """Test get identity details"""
    print("\n" + "="*60)
    print("Testing: Get Identity Details")
    print("="*60)
    try:
        response = requests.get(
            f"{BASE_URL}/api/identity/{identity_id}",
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            print_success("Identity details retrieved")
            print_info(f"Username: {data.get('username', 'Not set')}")
            print_info(f"Status: {data['status']}")
            print_info(f"Verification Level: {data['verificationLevel']}")
            print_info(f"Assets Count: {len(data['assets'])}")
            return True
        else:
            print_error(f"Request failed: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_update_username(token, identity_id):
    """Test username update"""
    print("\n" + "="*60)
    print("Testing: Update Username")
    print("="*60)
    try:
        headers = {"Authorization": f"Bearer {token}"}
        payload = {"username": "testuser"}
        response = requests.patch(
            f"{BASE_URL}/api/identity/{identity_id}/username",
            headers=headers,
            json=payload,
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            print_success(f"Username updated to: {data['username']}")
            return True
        elif response.status_code == 409:
            print_warning("Username already taken (this is expected)")
            return True
        else:
            print_error(f"Request failed: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_kyc_start(token):
    """Test KYC start"""
    print("\n" + "="*60)
    print("Testing: Start KYC")
    print("="*60)
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(
            f"{BASE_URL}/api/kyc/start",
            headers=headers,
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            print_success("KYC session started")
            print_info(f"KYC ID: {data['kyc_id']}")
            print_info(f"Status: {data['status']}")
            return True
        else:
            print_error(f"Request failed: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def main():
    """Run all tests"""
    print("\n")
    print("="*60)
    print("  HVID API Test Suite")
    print("="*60)
    print(f"Testing server: {BASE_URL}")
    print(f"Test phone: {TEST_PHONE}")
    print(f"Test OTP: {TEST_OTP}")
    
    results = []
    
    # Test 1: Health check
    results.append(("Health Check", test_health()))
    
    if not results[-1][1]:
        print_error("\n✗ Server is not running. Cannot continue tests.")
        print_info(f"Start the server with: python app.py")
        sys.exit(1)
    
    # Test 2: Request OTP
    results.append(("Request OTP", test_request_otp()))
    
    # Test 3: Verify OTP and get token
    token, identity_id = test_verify_otp()
    results.append(("Verify OTP", token is not None))
    
    if token and identity_id:
        # Test 4: Get current user
        results.append(("Get Current User", test_get_me(token)))
        
        # Test 5: Match check
        results.append(("Match Check", test_match_check()))
        
        # Test 6: Get identity details
        results.append(("Get Identity", test_get_identity(identity_id)))
        
        # Test 7: Update username
        results.append(("Update Username", test_update_username(token, identity_id)))
        
        # Test 8: KYC start
        results.append(("Start KYC", test_kyc_start(token)))
    
    # Print summary
    print("\n" + "="*60)
    print("  Test Summary")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        color = Colors.GREEN if result else Colors.RED
        print(f"{color}{status}{Colors.END} - {test_name}")
    
    print("\n" + "="*60)
    print(f"Results: {passed}/{total} tests passed")
    print("="*60)
    
    if passed == total:
        print_success("\n🎉 All tests passed!")
        return 0
    else:
        print_error(f"\n❌ {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
