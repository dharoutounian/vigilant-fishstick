# App Store listing for Coinleaf

Copy these into App Store Connect. Character limits are Apple's, and every value
here fits within them.

## App information

| Field | Value |
|---|---|
| Name (30) | `Coinleaf: Budget & Expenses` |
| Subtitle (30) | `Budgets, spending & goals` |
| Primary category | Finance |
| Secondary category | Productivity |
| Bundle ID | `com.dharoutounian.coinleaf` (from `app.json`) |
| SKU | `coinleaf-ios` (any unique text works) |
| Content rights | Does not contain, show, or access third-party content |
| Age rating | Answer "No" / "None" to every question → **4+** |
| Price | Free |

## URLs

| Field | Value |
|---|---|
| Privacy Policy URL | https://dharoutounian.github.io/vigilant-fishstick/coinleaf/site/privacy.html |
| Support URL | https://dharoutounian.github.io/vigilant-fishstick/coinleaf/site/support.html |
| Marketing URL | *(optional, leave blank)* |

These pages live in `coinleaf/site/` and are published by the repository's GitHub
Pages workflow. They go live once this branch is merged into `main`. Open both
links in a browser to confirm they load before you submit.

## App Privacy ("nutrition label")

- **Do you or your third-party partners collect data from this app?** → **No**
- The label then reads **Data Not Collected**. This is accurate: the app has no
  servers, analytics, ads or SDKs that send data anywhere.

If you ever add analytics, crash reporting, ads, accounts or sync, update this
answer and the privacy policy before releasing that version.

## Promotional text (170)

```
Know where your money goes. Budgets, savings goals and spending insights in one calm, private app. No account, no ads, and nothing leaves your iPhone.
```

## Description (4000)

```
Coinleaf is a simple, private way to see where your money goes, stay within budget and save for what matters. No account, no bank login, no ads, no tracking. Everything stays on your iPhone.

SEE WHERE IT GOES
• A clear monthly overview of what you spent, earned and saved
• Spending by category at a glance, plus a six-month trend
• A quick comparison with the same point last month

BUDGETS THAT KEEP UP
• Monthly limits for the categories you care about
• See what's left and how much you can spend per day
• An amber warning at 80% and red when you're over
• Suggested limits based on what you actually spent

SAVE FOR WHAT MATTERS
• Savings goals with a target and an optional date
• Know how much to set aside each month to get there
• Add or withdraw money and keep a history

FAST, FLEXIBLE TRACKING
• Add an expense or income in seconds
• Repeating transactions for rent, salary and subscriptions, added automatically on their dates
• Custom categories with your own icons and colors
• Search every transaction by note, category or amount
• 45+ currencies

PRIVATE BY DESIGN
• No account or sign-up
• Your data never leaves your device
• Optional Face ID or Touch ID lock
• Export everything to a spreadsheet (CSV) whenever you like
• Looks great in Dark Mode

Coinleaf doesn't connect to your bank, so you stay in control of exactly what you record.
```

## Keywords (100)

```
budget,expense tracker,spending,money,savings,goals,finance,bills,planner,personal,wallet,cash
```

(94 characters. Words already in the name don't need repeating.)

## Copyright

```
2026 Donnie Haroutounian
```

## App Review information

- **Sign-in required:** No
- **Notes:**

```
Coinleaf has no login and no server. All data is stored locally on the device.

To try it: tap + on the Overview tab to add an expense or income. Budgets and Goals work without any setup. Settings > App Lock uses Face ID / Touch ID through the system LocalAuthentication framework. Settings > Export creates a CSV file and opens the share sheet.
```

- **Contact information:** your name, phone number and email. Apple uses these only
  to reach you about the review, and they aren't shown publicly.

## Screenshots

`store/screenshots/` holds six 1320 × 2868 PNGs, the **6.9" iPhone Display** size.
Upload them in this order. App Store Connect scales them down for smaller iPhones.

1. `01-overview.png`: See where your money goes
2. `02-budgets.png`: Budgets that keep you on track
3. `03-goals.png`: Save for what matters
4. `04-add.png`: Add spending in seconds
5. `05-activity.png`: Every transaction, searchable
6. `06-dark.png`: Private by design

They're made from the app's web build with sample data by `scripts/screenshots.js`.
Once the app is on your iPhone through TestFlight, you can replace them with real
captures. Screenshots taken on an iPhone 16 Pro Max or 17 Pro Max are already exactly
1320 × 2868.
