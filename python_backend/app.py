"""
VeloRail National Express — Python FastAPI & SQLAlchemy Reservation Engine
Provides equivalent SQL + Python REST endpoints and CLI fare/schedule calculation
for passengers to reserve tickets, inspect itemized bills, and receive real-time
delay or platform change notifications.
"""
import os
import json
import sys
from datetime import datetime
from typing import Optional, List

# Pure Python Fare & Schedule Engine (can be invoked via CLI or FastAPI)
CLASS_MULTIPLIERS = {
    "Standard": 0.0,
    "Business": 0.40,
    "First Class": 0.70,
}

CATERING_RATES = {
    "None": 0,
    "Light Refreshments": 10,
    "Artisanal Bistro Tray": 18,
    "Executive Dining Service": 24,
}


def calculate_bill(base_fare: int, coach_class: str, catering_addon: str, passenger_age: int) -> dict:
    multiplier = CLASS_MULTIPLIERS.get(coach_class, 0.0)
    raw_surcharge = round(base_fare * multiplier)
    seat_fare = base_fare + raw_surcharge

    discount = 0
    discount_label = None
    if passenger_age >= 60:
        discount = round(seat_fare * 0.15)
        discount_label = "Senior Citizen Concession (15%)"
    elif 0 < passenger_age < 12:
        discount = round(seat_fare * 0.25)
        discount_label = "Child Fare Concession (25%)"

    net_surcharge = max(0, raw_surcharge - discount)
    adjusted_base = base_fare if raw_surcharge >= discount else max(0, base_fare - (discount - raw_surcharge))
    catering_charge = CATERING_RATES.get(catering_addon, 0)
    subtotal = adjusted_base + net_surcharge + catering_charge
    tax_amount = round(subtotal * 0.10)
    total_amount = subtotal + tax_amount

    return {
        "baseAmount": adjusted_base,
        "classSurcharge": net_surcharge,
        "ageDiscount": discount,
        "cateringCharge": catering_charge,
        "subtotal": subtotal,
        "taxAmount": tax_amount,
        "totalAmount": total_amount,
        "discountLabel": discount_label,
        "engine": "Python 3 Railway Billing Engine",
    }


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--calculate":
        payload = json.loads(sys.argv[2])
        result = calculate_bill(
            int(payload.get("baseFare", 95)),
            str(payload.get("coachClass", "Standard")),
            str(payload.get("cateringAddon", "None")),
            int(payload.get("passengerAge", 30)),
        )
        print(json.dumps(result))
