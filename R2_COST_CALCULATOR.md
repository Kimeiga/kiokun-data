# R2 Cost Calculator for Your Dictionary

## 📊 Your Dictionary Stats

```
Total files: 431,750
File size: ~1.7-3 GB
Average file size: ~4 KB
```

## 💰 R2 Pricing

### Free Tier (per account, per month):
```
Storage: 10 GB FREE
Class A Operations (uploads/writes): 1,000,000 FREE
Class B Operations (reads/downloads): 10,000,000 FREE
```

### Paid Tier (after free tier):
```
Storage: $0.015 per GB per month
Class A Operations: $4.50 per million
Class B Operations: $0.36 per million
```

## 🔢 How Many Updates Can You Do For FREE?

### Scenario 1: Full Dictionary Updates (100% of files)
```
Files per update: 431,750
Operations per update: 431,750 (Class A)

Free tier: 1,000,000 operations/month
Updates per month (FREE): 1,000,000 ÷ 431,750 = 2.31 updates

Frequency: Every ~13 days
```

**Verdict:** You can do 2 full updates per month for FREE!

---

### Scenario 2: Typical Code Changes (1% of files)
```
Files per update: 431,750 × 1% = 4,317
Operations per update: 4,317 (Class A)

Free tier: 1,000,000 operations/month
Updates per month (FREE): 1,000,000 ÷ 4,317 = 231 updates

Frequency: 7-8 updates per day!
```

**Verdict:** You can update 231 times per month for FREE!

---

### Scenario 3: Small Feature (5% of files)
```
Files per update: 431,750 × 5% = 21,587
Operations per update: 21,587 (Class A)

Free tier: 1,000,000 operations/month
Updates per month (FREE): 1,000,000 ÷ 21,587 = 46 updates

Frequency: 1-2 updates per day
```

**Verdict:** You can update 46 times per month for FREE!

---

### Scenario 4: Major Refactor (10% of files)
```
Files per update: 431,750 × 10% = 43,175
Operations per update: 43,175 (Class A)

Free tier: 1,000,000 operations/month
Updates per month (FREE): 1,000,000 ÷ 43,175 = 23 updates

Frequency: Almost daily
```

**Verdict:** You can update 23 times per month for FREE!

---

### Scenario 5: Large Changes (50% of files)
```
Files per update: 431,750 × 50% = 215,875
Operations per update: 215,875 (Class A)

Free tier: 1,000,000 operations/month
Updates per month (FREE): 1,000,000 ÷ 215,875 = 4.6 updates

Frequency: Weekly
```

**Verdict:** You can update 4-5 times per month for FREE!

---

## 💸 What If You Exceed Free Tier?

### Cost Formula:
```
Cost = (Total Operations - 1,000,000) × $4.50 / 1,000,000
```

### Example 1: 3 Full Updates Per Month
```
Operations: 431,750 × 3 = 1,295,250
Free tier: 1,000,000
Overage: 1,295,250 - 1,000,000 = 295,250

Cost: 295,250 × $4.50 / 1,000,000 = $1.33/month
```

**Verdict:** $1.33/month for 3 full updates

---

### Example 2: Daily Updates (5% change each)
```
Operations: 21,587 × 30 = 647,610
Free tier: 1,000,000
Overage: 0 (still within free tier!)

Cost: $0/month
```

**Verdict:** FREE for daily updates with 5% changes!

---

### Example 3: Daily Full Updates (100% of files)
```
Operations: 431,750 × 30 = 12,952,500
Free tier: 1,000,000
Overage: 12,952,500 - 1,000,000 = 11,952,500

Cost: 11,952,500 × $4.50 / 1,000,000 = $53.79/month
```

**Verdict:** $53.79/month for daily full updates (unlikely scenario)

---

### Example 4: Hourly Updates (5% change each)
```
Operations: 21,587 × 24 × 30 = 15,543,120
Free tier: 1,000,000
Overage: 15,543,120 - 1,000,000 = 14,543,120

Cost: 14,543,120 × $4.50 / 1,000,000 = $65.44/month
```

**Verdict:** $65.44/month for hourly updates (extreme scenario)

---

## 📈 Cost Table by Update Frequency

| Update Frequency | Files Changed | Operations/Month | Cost/Month |
|-----------------|---------------|------------------|------------|
| **2x/month (full)** | 100% | 863,500 | **$0** ✅ |
| **Weekly (full)** | 100% | 1,727,000 | **$3.27** |
| **Daily (full)** | 100% | 12,952,500 | **$53.79** |
| **Daily (5% change)** | 5% | 647,610 | **$0** ✅ |
| **Daily (10% change)** | 10% | 1,295,250 | **$1.33** |
| **Daily (50% change)** | 50% | 6,476,250 | **$24.64** |
| **Hourly (1% change)** | 1% | 3,108,240 | **$9.49** |
| **Hourly (5% change)** | 5% | 15,543,120 | **$65.44** |

## 🎯 Realistic Usage Scenarios

### Scenario A: Active Development (Most Likely)
```
Frequency: 1-2 updates per day
Files changed: 5-10% per update
Operations: ~647,610 - 1,295,250/month

Cost: $0 - $1.33/month
```

**Verdict:** Essentially FREE during active development!

---

### Scenario B: Stable Production (Most Likely Long-term)
```
Frequency: 1-2 updates per week
Files changed: 5-10% per update
Operations: ~86,348 - 345,400/month

Cost: $0/month
```

**Verdict:** Completely FREE in production!

---

### Scenario C: Extreme CI/CD (Unlikely)
```
Frequency: Every commit (10+ times per day)
Files changed: 5% per update
Operations: ~6,476,250/month

Cost: $24.64/month
```

**Verdict:** Even with extreme CI/CD, only $25/month!

---

## 💡 Cost Optimization Tips

### 1. Use Incremental Updates (You Already Are!)
```bash
# rclone sync only uploads changed files
rclone sync output_dictionary r2:bucket/dictionary

# First upload: 431,750 files
# Subsequent: Only changed files (typically 1-10%)
```

**Savings:** 90-99% reduction in operations!

---

### 2. Batch Updates
```
Instead of: 10 updates per day (5% each) = 2,158,700 ops/month = $5.21
Do: 1 update per day (50% total) = 6,476,250 ops/month = $24.64

Wait, that's MORE expensive!

Actually, do: 1 update per day (5% each) = 647,610 ops/month = $0

The key: Don't update more frequently than needed!
```

---

### 3. Monitor Usage
```bash
# Check R2 usage in Cloudflare Dashboard
# Set up alerts at 80% of free tier (800,000 operations)
# You'll get warning before hitting paid tier
```

---

### 4. Use GitHub Actions Wisely
```yaml
# Only trigger on main branch (not every PR)
on:
  push:
    branches: [main]
  
# Or use manual trigger only
on:
  workflow_dispatch:
```

---

## 📊 Storage Costs (Separate from Operations)

### Your Storage:
```
Current: 1.7-3 GB
Free tier: 10 GB

Cost: $0/month (well within free tier)
```

### If You Grow:
```
At 15 GB:
  Free: 10 GB
  Paid: 5 GB × $0.015 = $0.075/month
  Total: $0.08/month

At 50 GB:
  Free: 10 GB
  Paid: 40 GB × $0.015 = $0.60/month
  Total: $0.60/month

At 100 GB:
  Free: 10 GB
  Paid: 90 GB × $0.015 = $1.35/month
  Total: $1.35/month
```

**Verdict:** Storage is VERY cheap!

---

## 🎯 Bottom Line

### For Your Use Case:

**Most Realistic Scenario:**
- Update frequency: 1-2 times per day during development
- Files changed: 5-10% per update
- Operations: ~647,610 - 1,295,250/month
- **Cost: $0 - $1.33/month**

**Production Scenario:**
- Update frequency: 1-2 times per week
- Files changed: 5-10% per update
- Operations: ~86,348 - 345,400/month
- **Cost: $0/month**

### When Would You Pay?

You'd only start paying if you:
1. Do more than 2 full updates per month, OR
2. Do more than 46 updates per month with 5% changes, OR
3. Do more than 23 updates per month with 10% changes

**And even then, it's only $1-5/month for reasonable usage!**

---

## 🚀 Comparison with GitHub Approach

### GitHub + jsDelivr:
```
Cost: $0/month (forever)
Update frequency: Unlimited
Deployment time: 40-75 minutes per update
```

### Cloudflare R2:
```
Cost: $0/month (for realistic usage)
Update frequency: 2-46 updates/month (free)
Deployment time: 10-25 minutes per update

If you exceed free tier:
  Cost: $1-5/month (for heavy usage)
  Still 3x faster than GitHub!
```

---

## 💡 Final Recommendation

**Use R2 because:**

1. ✅ **FREE for realistic usage** (1-2 updates/day with 5-10% changes)
2. ✅ **3x faster** than GitHub approach
3. ✅ **Even if you pay, it's only $1-5/month** for heavy usage
4. ✅ **Incremental updates** save 90-99% of operations
5. ✅ **You can monitor usage** and adjust if needed

**You'd have to update VERY aggressively to exceed the free tier!**

And even if you do, $1-5/month is worth the 3x speed improvement! 🚀

