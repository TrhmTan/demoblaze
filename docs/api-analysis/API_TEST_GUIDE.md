# 🧪 Manual API Testing Guide - Uncertain Cases

## 📋 Mục đích
Test 16 uncertain API cases để xác định exact expected results (thay vì "400 or 200").

---

## 📦 Files cần thiết

1. **Demoblaze_Uncertain_Cases.postman_collection.json** - Postman collection
2. **Uncertain_API_Results_Template.xlsx** - Template để document kết quả
3. **API_TEST_GUIDE.md** - Guide này

---

## 🚀 Setup

### Option A: Sử dụng Postman (Recommended)
1. Mở Postman
2. Click **Import** → Chọn `Demoblaze_Uncertain_Cases.postman_collection.json`
3. Collection sẽ được load vào Postman

### Option B: Sử dụng cURL (Nếu không có Postman)
- Xem phần cURL commands ở dưới

---

## 📝 Testing Steps

### Step 1: Open Template
- Mở file `Uncertain_API_Results_Template.xlsx`
- Cột có để sẵn, bạn chỉ cần điền kết quả

### Step 2: Run Each Test Case
Chạy từng test case theo thứ tự:

#### **GROUP 1: LOGIN TESTS** (4 cases)

| TC ID | Test | What to Do |
|---|---|---|
| API-LOG-002 | Wrong password | POST `/login` với username=testuser, password=wrongpass |
| API-LOG-004 | Empty username | POST `/login` với username="" (empty) |
| API-LOG-005 | Empty password | POST `/login` với password="" (empty) |
| API-LOG-006 | SQL injection | POST `/login` với `' OR '1'='1` |

#### **GROUP 2: CART TESTS** (3 cases)

| TC ID | Test | What to Do |
|---|---|---|
| API-CART-001 | Valid guest cookie | POST `/viewcart` với cookie=guest_12345 |
| API-CART-002 | Empty cookie | POST `/viewcart` với cookie="" (empty) |
| API-CART-003 | Missing cookie | POST `/viewcart` với body {} (no cookie field) |

#### **GROUP 3: PRODUCT TESTS** (3 cases)

| TC ID | Test | What to Do |
|---|---|---|
| API-PROD-003 | Invalid ID | POST `/view` với idp_=99999 (không tồn tại) |
| API-PROD-004 | Missing ID | POST `/view` với body {} (no idp_ field) |
| API-PROD-005 | Zero ID | POST `/view` với idp_=0 |

#### **GROUP 4: ADD TO CART TESTS** (3 cases)

| TC ID | Test | What to Do |
|---|---|---|
| API-ADD-003 | Invalid product | POST `/addtocart` với prod_id=99999 |
| API-ADD-004 | Missing cookie | POST `/addtocart` không có cookie field |
| API-ADD-005 | flag=false | POST `/addtocart` với flag=false |

#### **GROUP 5: DELETE TESTS** (2 cases)

| TC ID | Test | What to Do |
|---|---|---|
| API-DEL-002 | Non-existent item | POST `/deleteitem` với id=99999 |
| API-DEL-003 | Missing cookie | POST `/deleteitem` không có cookie field |

#### **GROUP 6: CONFIG TEST** (1 case)

| TC ID | Test | What to Do |
|---|---|---|
| API-CONF-001 | Get config | GET `/config.json` |

---

## 📊 Recording Results

### Trong Postman:
1. Chạy request
2. Check **Status Code** ở phía kanan
3. Check **Response Body** (JSON)
4. Copy vào Excel template:

**Columns to fill:**
- **Status Code**: Ví dụ: 200, 400, 404
- **Response Body**: Paste JSON response (first 100 chars)
- **Actual Result**: Mô tả kết quả (ví dụ: "Returns 200 with Auth=false")
- **Recommended Expected Result**: Your suggestion (ví dụ: "Response 200 with Auth=false")
- **Notes**: Ghi chú bất kỳ anomaly

### Ví dụ:

```
TC ID: API-LOG-002
Endpoint: POST /login
Test Data: {"username": "testuser", "password": "wrongpass"}
Status Code: 200
Response Body: {"Auth":false}
Actual Result: Returns 200 with Auth property set to false
Recommended Expected Result: Response 200 with Auth=false
Notes: API doesn't return error message, just Auth flag
```

---

## 🔧 cURL Commands (Nếu không dùng Postman)

### Copy-paste vào Terminal:

```bash
# API-LOG-002
curl -X POST https://api.demoblaze.com/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"wrongpass"}'

# API-LOG-004
curl -X POST https://api.demoblaze.com/login \
  -H "Content-Type: application/json" \
  -d '{"username":"","password":"pass123"}'

# API-LOG-005
curl -X POST https://api.demoblaze.com/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":""}'

# API-LOG-006
curl -X POST https://api.demoblaze.com/login \
  -H "Content-Type: application/json" \
  -d '{"username":"'"'"' OR '"'"'1'"'"'='"'"'1","password":"'"'"' OR '"'"'1'"'"'='"'"'1"}'

# API-CART-001
curl -X POST https://api.demoblaze.com/viewcart \
  -H "Content-Type: application/json" \
  -d '{"cookie":"guest_1234567890"}'

# API-CART-002
curl -X POST https://api.demoblaze.com/viewcart \
  -H "Content-Type: application/json" \
  -d '{"cookie":""}'

# API-CART-003
curl -X POST https://api.demoblaze.com/viewcart \
  -H "Content-Type: application/json" \
  -d '{}'

# API-PROD-003
curl -X POST https://api.demoblaze.com/view \
  -H "Content-Type: application/json" \
  -d '{"idp_":99999}'

# API-PROD-004
curl -X POST https://api.demoblaze.com/view \
  -H "Content-Type: application/json" \
  -d '{}'

# API-PROD-005
curl -X POST https://api.demoblaze.com/view \
  -H "Content-Type: application/json" \
  -d '{"idp_":0}'

# API-ADD-003
curl -X POST https://api.demoblaze.com/addtocart \
  -H "Content-Type: application/json" \
  -d '{"cookie":"test_user","prod_id":99999,"flag":true}'

# API-ADD-004
curl -X POST https://api.demoblaze.com/addtocart \
  -H "Content-Type: application/json" \
  -d '{"prod_id":1,"flag":true}'

# API-ADD-005
curl -X POST https://api.demoblaze.com/addtocart \
  -H "Content-Type: application/json" \
  -d '{"cookie":"test_user","prod_id":1,"flag":false}'

# API-DEL-002
curl -X POST https://api.demoblaze.com/deleteitem \
  -H "Content-Type: application/json" \
  -d '{"cookie":"test_user","id":99999}'

# API-DEL-003
curl -X POST https://api.demoblaze.com/deleteitem \
  -H "Content-Type: application/json" \
  -d '{"id":1}'

# API-CONF-001
curl -X GET https://demoblaze.com/config.json
```

---

## ✅ Checklist

- [ ] Import Postman collection
- [ ] Open Excel template
- [ ] Test API-LOG-002 → Record result
- [ ] Test API-LOG-004 → Record result
- [ ] Test API-LOG-005 → Record result
- [ ] Test API-LOG-006 → Record result
- [ ] Test API-CART-001 → Record result
- [ ] Test API-CART-002 → Record result
- [ ] Test API-CART-003 → Record result
- [ ] Test API-PROD-003 → Record result
- [ ] Test API-PROD-004 → Record result
- [ ] Test API-PROD-005 → Record result
- [ ] Test API-ADD-003 → Record result
- [ ] Test API-ADD-004 → Record result
- [ ] Test API-ADD-005 → Record result
- [ ] Test API-DEL-002 → Record result
- [ ] Test API-DEL-003 → Record result
- [ ] Test API-CONF-001 → Record result
- [ ] Save Excel file
- [ ] Send file to me for analysis

---

## 📤 When Done

1. Save Excel file với results
2. Send file tới tôi
3. Tôi sẽ:
   - Review kết quả
   - Suggest expected results
   - Update TC manual
   - Generate updated `api.spec.ts`

---

## 💡 Tips

1. **Use Postman** - Dễ hơn cURL
2. **Copy-paste response** - Paste full JSON response vào Notes
3. **Note anomalies** - Nếu behavior bất thường, ghi chú
4. **Check status code first** - Đây là cái quan trọng nhất

---

## ❓ Questions?

Nếu không clear, hãy ask!
