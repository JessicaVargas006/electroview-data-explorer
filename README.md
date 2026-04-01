# ⚡ ElectroView - Electronics Data Explorer

A single-page HTML/CSS/JS app for exploring electronics datasets. Runs entirely in your browser—no backend required.

## 🚀 Quick Start (30 seconds)

1. **Download** all files to a folder
2. **Double-click** `index.html`
3. **Click** "Load Sample Electronics Data"
4. **Explore!** Filter, visualize, and export

That's it. No installation, no server, no dependencies to install.

---

## 📁 What's Included

```
electroview/
├── index.html      # Main app (structure + CDN links)
├── sample-electronics-sales.csv      # sample data
├── styles.css      # Modern dark theme styling
├── app.js          # All app logic (~780 lines)
└── README.md       # This file
```

---

## 📊 Expected Data Format

ElectroView works best with electronics data containing these columns (all optional):

### Core Columns
- **ProductID** - Unique identifier
- **ProductName** - Product name
- **Category** - Product category (Phones, Laptops, Audio, etc.)
- **Brand** - Manufacturer name

### Financial Columns
- **Price** - Selling price
- **Cost** - Manufacturing/wholesale cost
- **Margin** - Auto-computed: `(Price - Cost) / Price` if both exist

### Performance Columns
- **Rating** - Customer rating (0-5)
- **Stock** - Units available
- **UnitsSold** - Units sold
- **ReturnRate** - Return percentage (0-1 or 0-100%)

### Temporal Columns
- **LaunchDate** or **DateAdded** - Product introduction date

### Computed Columns
The app automatically adds:
- **Margin** - If Price and Cost exist
- **Revenue** - If Price and UnitsSold exist (Price × UnitsSold)

---

## 🎯 Features

### 1. **Data Loading (3 methods)**
- 📤 Upload CSV file
- 📋 Paste CSV data directly
- 📊 Load sample electronics data (20 products included)

### 2. **Overview Dashboard**
- Summary chips: Rows, Columns, Missing %, Size
- KPI cards: Avg Price, Avg Cost, Avg Margin, Avg Rating (if columns exist)
- Data dictionary table with inferred types

### 3. **Dynamic Filters**
Auto-generated based on column type:
- **Categorical**: Multi-select (top 50 by frequency)
- **Numeric**: Min/max range inputs
- **Date**: From/to date pickers
- **Text**: Substring search

All filters use AND logic and update instantly.

### 4. **Interactive Charts (5 types)**

**Histogram** - Distribution of numeric columns
- Choose column (Price, Rating, Stock, etc.)
- Adjustable bins (10-50)

**Bar Chart (Top-K)** - Categorical frequency
- Choose column (Category, Brand, etc.)
- Top 5-50 values

**Scatter Plot** - Numeric relationships
- X vs Y axes (Price vs UnitsSold, etc.)
- Optional color grouping by category
- Visual correlation analysis

**Box Plot** - Distribution by category
- Choose numeric column
- Optional grouping by categorical column

**Correlation Heatmap** - Pearson correlation matrix
- All numeric columns
- Color-coded: Blue = positive, Red = negative

### 5. **Quick Insights**
If applicable columns exist, auto-computed tiles show:
- 🏆 Top brand by sales volume
- ⭐ Best-rated brand
- 💰 Top category by revenue
- 📊 Average margin %

### 6. **Data Table**
- Sortable columns (click header)
- Search across all columns
- Pagination (25 rows/page)
- Shows filtered count

### 7. **Export**
- 💾 Download filtered CSV
- 💾 Download chart as PNG

### 8. **UX Polish**
- 🌙 Dark/light theme toggle
- 🔄 Reset app button
- Toast notifications
- Loader animations
- Responsive design

---

## 💡 Usage Examples

### Load Your Own Data
1. Click "Upload CSV File" or paste data
2. Click "Load Data"
3. Wait for success toast
4. Start exploring!

**Important**: Your CSV must have a header row with column names.

### Filter Examples
- **Find high-end phones**: Category = "Phones", Price ≥ 800
- **Check low stock**: Stock ≤ 50
- **Recent launches**: LaunchDate ≥ 2023-01-01
- **Search by name**: ProductName contains "Pro"

### Chart Examples
- **Price distribution**: Histogram → Price → 30 bins
- **Category popularity**: Bar Chart → Category → Top 10
- **Price vs Sales**: Scatter → X=Price, Y=UnitsSold, Color=Brand
- **Price by category**: Box Plot → Price by Category
- **Feature correlations**: Heatmap → See all numeric relationships

---

## ⚙️ Technical Details

### Type Inference
The app automatically detects column types:
- **Numeric**: >80% values parse to numbers
- **Date**: >80% valid dates (requires 4-digit year)
- **Categorical**: ≤50 unique values or ≤20% of rows
- **Text**: Everything else

### Performance
- Handles up to 50k rows efficiently
- Prompts to sample if dataset is larger
- Debounced text search (500ms)
- Cached chart instances

### Browser Compatibility
Works on modern browsers (Chrome, Firefox, Safari, Edge)
- Requires ES6+ support
- Canvas API for charts
- FileReader API for uploads

### CDN Libraries (loaded from internet)
- **Papa Parse 5.4.1** - CSV parsing
- **Chart.js 4.x** - Interactive charts
- **dayjs 1.x** - Date parsing

---

## 🐛 Troubleshooting

### "No data found in CSV"
- Ensure your CSV has a header row
- Check for correct comma separation
- Try copying sample data first to test

### "Chart empty or missing"
- Check if required column types exist
- Histogram/Box need numeric columns
- Bar charts need categorical columns
- Heatmap needs 2+ numeric columns

### Filters not working
- Ensure column types inferred correctly (check Data Dictionary)
- For dates, use YYYY-MM-DD format
- Numeric filters only work on actual numbers

### Performance issues
- Reduce dataset to <50k rows
- Use filters to narrow scope
- Clear browser cache and reload

---

## 📝 Customization Tips

### Change Sample Data
Edit the `SAMPLE_CSV` constant in `app.js` (lines 10-30) with your own CSV data.

### Adjust Chart Colors
Edit color arrays in chart render functions:
- `renderScatterPlot()` line ~479: `colors` array
- Chart.js backgroundColor properties

### Modify Filter Limits
- **Categorical limit**: Line ~214 - Change `.slice(0, 50)`
- **Date ranges**: Lines ~266-267 - Adjust defaults
- **Numeric decimals**: Line ~232 - Change `.toFixed(2)`

### Change Page Size
Line 11: `rowsPerPage: 25` - Adjust to show more/fewer rows per page

---

## 🎨 Theme Customization

Edit CSS variables in `styles.css` (lines 9-23):

```css
--accent-primary: #6366f1;  /* Primary brand color */
--success: #10b981;          /* Success messages */
--warning: #f59e0b;          /* Warning messages */
--error: #ef4444;            /* Error messages */
```

Toggle between dark/light themes using the 🌙/☀️ button.

---

## 🔒 Privacy & Security

- **100% client-side** - No data leaves your browser
- **No tracking** - No analytics, no cookies
- **No server** - Everything runs locally
- **Safe parsing** - CSV parsing is sandboxed

Your data stays on your machine. Perfect for sensitive electronics inventory or sales data.

---

## 📖 Sample Data Details

The included sample has 20 electronics products across 8 categories:
- Phones (Apple, Samsung, Google)
- Laptops (Apple, Dell, Lenovo)
- Audio (Apple, Sony, Bose)
- Tablets (Apple, Samsung)
- Accessories (Apple, Logitech, Anker)
- Wearables (Apple, Samsung)
- TVs (LG, Samsung)
- Smart Home (Amazon, Google)

Price range: $45 - $2,499
Dates: 2020 - 2023

---

## 🚀 What's Next?

Try these explorations with the sample data:

1. **Brand analysis**: Filter by Brand → See price distribution
2. **Category profitability**: View margin by Category in box plot
3. **Price vs performance**: Scatter plot Price vs Rating
4. **Seasonal trends**: Filter by LaunchDate ranges
5. **Top sellers**: Bar chart of UnitsSold by Brand

---

## 📄 License

Free to use and modify for any purpose. No attribution required.

---

## 🤝 Credits

Built with ❤️ following Vibe Coding principles:
- Clear visual hierarchy
- Progressive disclosure
- Instant feedback
- Defensive defaults

**Tools**: Vanilla JS, Chart.js, Papa Parse, dayjs

---

**Questions?** Open `index.html` and start exploring. Everything is self-documented in the code.

**Enjoy exploring your electronics data! ⚡📊**
