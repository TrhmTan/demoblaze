# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cart.spec.ts >> CartPage Test Suite >> TC-CRT-035: Year - 2-digit input (25) [DEF-003]
- Location: tests\cart.spec.ts:811:9

# Error details

```
Test timeout of 90000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=f2e1]:
  - dialog [active] [ref=f2e2]:
    - document [ref=f2e3]:
      - generic [ref=f2e4]:
        - generic [ref=f2e5]:
          - heading "Place order" [level=5] [ref=f2e6]
          - button "Close" [ref=f2e7] [cursor=pointer]: ×
        - generic [ref=f2e9]:
          - generic [ref=f2e10]: "Total: 360"
          - generic [ref=f2e11]:
            - generic [ref=f2e12]: "Name:"
            - 'textbox "Total: 360 Name:" [ref=f2e13]': John Doe
          - generic [ref=f2e14]:
            - generic [ref=f2e15]: "Country:"
            - textbox "Country:" [ref=f2e16]
          - generic [ref=f2e17]:
            - generic [ref=f2e18]: "City:"
            - textbox "City:" [ref=f2e19]
          - generic [ref=f2e20]:
            - generic [ref=f2e21]: "Credit card:"
            - textbox "Credit card:" [ref=f2e22]: "4111111111111111"
          - generic [ref=f2e23]:
            - generic [ref=f2e24]: "Month:"
            - textbox "Month:" [ref=f2e25]
          - generic [ref=f2e26]:
            - generic [ref=f2e27]: "Year:"
            - textbox "Year:" [ref=f2e28]: "25"
        - generic [ref=f2e30]:
          - button "Close" [ref=f2e31]
          - button "Purchase" [ref=f2e32]
  - text:             
  - navigation [ref=f2e33]:
    - generic [ref=f2e34]:
      - link "PRODUCT STORE" [ref=f2e35] [cursor=pointer]:
        - /url: index.html
      - list [ref=f2e38]:
        - listitem [ref=f2e39]:
          - link "Home (current)" [ref=f2e40] [cursor=pointer]:
            - /url: index.html
            - text: Home
            - generic [ref=f2e41]: (current)
        - listitem [ref=f2e42]:
          - link "Contact" [ref=f2e43] [cursor=pointer]:
            - /url: "#"
        - listitem [ref=f2e44]:
          - link "About us" [ref=f2e45] [cursor=pointer]:
            - /url: "#"
        - listitem [ref=f2e46]:
          - link "Cart" [ref=f2e47] [cursor=pointer]:
            - /url: "#"
        - listitem [ref=f2e48]:
          - link "Log in" [ref=f2e49] [cursor=pointer]:
            - /url: "#"
        - listitem
        - listitem
        - listitem [ref=f2e50]:
          - link "Sign up" [ref=f2e51] [cursor=pointer]:
            - /url: "#"
  - generic [ref=f2e53]:
    - generic [ref=f2e54]:
      - heading "Products" [level=2] [ref=f2e55]
      - table [ref=f2e57]:
        - rowgroup [ref=f2e58]:
          - row [ref=f2e59]:
            - columnheader "Pic" [ref=f2e60]
            - columnheader "Title" [ref=f2e61]
            - columnheader "Price" [ref=f2e62]
            - columnheader "x" [ref=f2e63]
        - rowgroup [ref=f2e64]:
          - row [ref=f2e65]:
            - cell [ref=f2e66]
            - cell "Samsung galaxy s6" [ref=f2e68]
            - cell "360" [ref=f2e69]
            - cell [ref=f2e70]:
              - link "Delete" [ref=f2e71] [cursor=pointer]:
                - /url: "#"
    - generic [ref=f2e72]:
      - heading "Total" [level=2] [ref=f2e73]
      - heading "360" [level=3] [ref=f2e76]
      - button "Place Order" [ref=f2e77]
  - generic [ref=f2e79]:
    - generic [ref=f2e82]:
      - heading "About Us" [level=4] [ref=f2e83]
      - paragraph [ref=f2e84]: We believe performance needs to be validated at every stage of the software development cycle and our open source compatible, massively scalable platform makes that a reality.
    - generic [ref=f2e87]:
      - heading "Get in Touch" [level=4] [ref=f2e88]
      - paragraph [ref=f2e89]: "Address: 2390 El Camino Real"
      - paragraph [ref=f2e90]: "Phone: +440 123456"
      - paragraph [ref=f2e91]: "Email: demo@blazemeter.com"
    - heading "PRODUCT STORE" [level=4] [ref=f2e95]
  - contentinfo [ref=f2e97]:
    - paragraph [ref=f2e98]: Copyright © Product Store
  - generic [ref=f2e101]:
    - heading "Thank you for your purchase!" [level=2] [ref=f2e107]
    - paragraph [ref=f2e108]: "Id: 2478887Amount: 360 USDCard Number: 4111111111111111Name: John DoeDate: 31/6/2026"
    - button "OK" [ref=f2e111]
```