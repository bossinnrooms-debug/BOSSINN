# House Pending Amount Fix - Summary

## Issues Fixed

### Issue 1: Extension Rent Double-Counting on Page Reload

**Problem:**
When reopening a house booking modal after navigation, the extension rent was being added twice to the "Total Rent" calculation, causing the pending amount to appear inflated.

**Root Cause:**
In the `fetchPaymentHistory` function (line 186), the code was creating a "Rent" entry using `booking.rent`, which already included all extensions and extra fees. This meant the transaction history would show:
1. Initial rent entry with the TOTAL rent (including extensions)
2. Separate extension entries with their amounts

This caused extensions to be counted twice in the `getTotalRentSoFar` calculation.

**Solution:**
Modified `fetchPaymentHistory` to calculate the **base rent** by subtracting extensions and extra fees from the total:

```typescript
// Calculate the BASE rent (initial rent without extensions/fees)
const extensionTotal = history
  .filter(entry => entry.type === 'extension')
  .reduce((sum, entry) => sum + entry.amount, 0);
const extraFeesTotal = history
  .filter(entry => entry.type === 'extra-fee')
  .reduce((sum, entry) => sum + entry.amount, 0);

const baseRent = booking.rent - extensionTotal - extraFeesTotal;
```

Now the transaction history shows:
1. Initial rent entry with ONLY the base rent
2. Separate extension entries with their amounts
3. Separate extra fee entries with their amounts

This ensures each amount is counted only once.

---

### Issue 2: House Card Pending Amount Not Updating

**Problem:**
The pending amount displayed on house cards (the 4 house overview cards) was not updating after:
- Adding extensions
- Adding payments
- Adding extra fees

The amount would only update after a full application refresh.

**Root Cause:**
The house cards were displaying `booking.pendingAmount` directly from the database (line 568), which was:
1. Only set during initial check-in
2. Never recalculated when extensions/payments/fees were added
3. Only updated via `increment()` when adding payments, but not accounting for extensions/fees

**Solution:**
Added a `calculatePendingAmount` function that:
1. Fetches all payment entries for a booking
2. Calculates total rent from `booking.rent` (which includes extensions/fees)
3. Calculates total paid from cash/gpay payments only
4. Returns the difference: `max(0, totalRent - totalPaid)`

This function is called in `fetchBookings` to recalculate pending amounts for all active bookings:

```typescript
// Recalculate pending amounts for all active bookings
const activeWithPending = await Promise.all(
  activeList.map(async (booking) => {
    const pending = await calculatePendingAmount(booking);
    return { ...booking, pendingAmount: pending };
  })
);
```

Now whenever `fetchBookings()` is called (after check-in, extension, payment, or fee), the pending amounts are recalculated from the actual transaction data.

---

## How It Works Now

### Data Flow:

1. **Check-in**: Initial rent stored in `booking.rent`, initial payment stored
2. **Extension**: Extension amount added to `booking.rent` via `increment()`
3. **Extra Fee**: Fee amount added to `booking.rent` via `increment()`
4. **Payment**: Payment amount added to `booking.initialPayment` via `increment()`

### Calculation Logic:

**In Modal (Transaction History):**
- Base Rent = `booking.rent - extensions - extraFees`
- Total Rent So Far = Base Rent + Extensions + Extra Fees
- Total Paid So Far = Cash Payments + GPay Payments
- Pending = Total Rent So Far - Total Paid So Far

**On House Cards:**
- Pending Amount = Recalculated from database on every `fetchBookings()` call
- Uses the same logic: `booking.rent - (cash + gpay payments)`

### Key Benefits:

1. **Consistent Calculations**: Modal and cards now use the same source of truth
2. **No Double-Counting**: Each transaction is counted exactly once
3. **Real-Time Updates**: Pending amounts update immediately after any change
4. **Database Integrity**: Uses actual transaction data, not stale cached values

---

## Testing Checklist

- [x] Check-in a guest - pending amount shows correctly on card
- [x] Add extension - pending amount increases on card
- [x] Add payment - pending amount decreases on card
- [x] Add extra fee - pending amount increases on card
- [x] Navigate away and return - pending amount remains correct
- [x] Open modal - transaction history shows each item once
- [x] Modal totals match card pending amount
- [x] Build successful with no errors

---

## Files Modified

**File:** `src/pages/houses/HousePage.tsx`

**Changes:**
1. Modified `fetchPaymentHistory` to calculate base rent correctly (lines 168-197)
2. Modified `fetchBookings` to recalculate pending amounts (lines 104-169)
3. Added `calculatePendingAmount` helper function (lines 146-169)
4. Updated pending display condition (line 565)

**Lines Changed:** ~70 lines total

---

## Technical Notes

- The fix maintains backward compatibility with existing bookings
- No database migration required
- Pending amounts are recalculated on-the-fly from transaction data
- Performance impact is minimal (one additional query per booking on load)
- All calculations now use server-side transaction data as source of truth
