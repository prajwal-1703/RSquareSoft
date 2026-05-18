"""
PulseGrid AI — Mortality Risk Prediction Service
FastAPI + XGBoost inference server
"""

import os
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

# ── Try to load XGBoost model, fall back to heuristic ────────────────────────
import xgboost as xgb

app = FastAPI(
    title="PulseGrid AI — Risk Intelligence Service",
    description="Mortality risk prediction and severity classification",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = os.getenv("MODEL_PATH", "/app/model/mortality_model.json")
model = None

try:
    model = xgb.Booster()
    model.load_model(MODEL_PATH)
    print(f"[AI] XGBoost model loaded from {MODEL_PATH}")
except Exception:
    print("[AI] No trained model found — using heuristic scoring engine")


# ── Request / Response schemas ───────────────────────────────────────────────

class PatientFeatures(BaseModel):
    age: float = Field(..., ge=0, le=150)
    heart_rate: float = Field(..., ge=0, le=300)
    systolic_bp: float = Field(..., ge=0, le=300)
    diastolic_bp: float = Field(..., ge=0, le=200)
    respiratory_rate: float = Field(..., ge=0, le=80)
    temperature: float = Field(..., ge=30, le=45)
    spo2: float = Field(..., ge=0, le=100)
    gcs_score: float = Field(..., ge=3, le=15, description="Glasgow Coma Scale")
    blood_glucose: Optional[float] = Field(120, ge=0, le=800)
    creatinine: Optional[float] = Field(1.0, ge=0, le=30)
    lactate: Optional[float] = Field(1.0, ge=0, le=30)
    wbc_count: Optional[float] = Field(7.5, ge=0, le=100)
    platelet_count: Optional[float] = Field(250, ge=0, le=1000)
    is_ventilated: Optional[bool] = False
    is_on_vasopressors: Optional[bool] = False


class RiskPrediction(BaseModel):
    risk_score: int
    risk_level: str
    recommended_action: str
    contributing_factors: list[str]
    confidence: float


# ── Heuristic scoring engine (fallback) ──────────────────────────────────────

def heuristic_risk_score(features: PatientFeatures) -> dict:
    """Rule-based mortality risk estimation when no ML model is available."""
    score = 0.0
    factors = []

    # Age factor
    if features.age > 80:
        score += 20
        factors.append("Advanced age (>80)")
    elif features.age > 65:
        score += 12
        factors.append("Elderly (>65)")
    elif features.age > 50:
        score += 5

    # Heart rate
    if features.heart_rate > 130 or features.heart_rate < 40:
        score += 18
        factors.append(f"Critical heart rate ({features.heart_rate} bpm)")
    elif features.heart_rate > 110 or features.heart_rate < 50:
        score += 10
        factors.append(f"Abnormal heart rate ({features.heart_rate} bpm)")

    # Blood pressure
    if features.systolic_bp < 80:
        score += 20
        factors.append(f"Severe hypotension (SBP {features.systolic_bp})")
    elif features.systolic_bp < 90:
        score += 14
        factors.append(f"Hypotension (SBP {features.systolic_bp})")
    elif features.systolic_bp > 200:
        score += 12
        factors.append(f"Hypertensive crisis (SBP {features.systolic_bp})")

    # SpO2
    if features.spo2 < 85:
        score += 22
        factors.append(f"Critical hypoxemia (SpO2 {features.spo2}%)")
    elif features.spo2 < 90:
        score += 15
        factors.append(f"Severe hypoxemia (SpO2 {features.spo2}%)")
    elif features.spo2 < 94:
        score += 8
        factors.append(f"Mild hypoxemia (SpO2 {features.spo2}%)")

    # GCS
    if features.gcs_score <= 8:
        score += 25
        factors.append(f"Severe neurological impairment (GCS {features.gcs_score})")
    elif features.gcs_score <= 12:
        score += 12
        factors.append(f"Moderate neurological impairment (GCS {features.gcs_score})")

    # Respiratory rate
    if features.respiratory_rate > 30 or features.respiratory_rate < 8:
        score += 15
        factors.append(f"Critical respiratory rate ({features.respiratory_rate})")
    elif features.respiratory_rate > 24:
        score += 8
        factors.append(f"Tachypnea ({features.respiratory_rate})")

    # Temperature
    if features.temperature > 40 or features.temperature < 35:
        score += 10
        factors.append(f"Temperature abnormality ({features.temperature}°C)")

    # Lactate
    if features.lactate and features.lactate > 4:
        score += 18
        factors.append(f"Elevated lactate ({features.lactate} mmol/L)")
    elif features.lactate and features.lactate > 2:
        score += 8
        factors.append(f"Mildly elevated lactate ({features.lactate} mmol/L)")

    # Creatinine
    if features.creatinine and features.creatinine > 3.5:
        score += 12
        factors.append(f"Acute kidney injury (Cr {features.creatinine})")
    elif features.creatinine and features.creatinine > 2.0:
        score += 6
        factors.append(f"Elevated creatinine ({features.creatinine})")

    # Ventilator / Vasopressors
    if features.is_ventilated:
        score += 12
        factors.append("Mechanically ventilated")
    if features.is_on_vasopressors:
        score += 14
        factors.append("On vasopressor support")

    # Platelet count
    if features.platelet_count and features.platelet_count < 50:
        score += 12
        factors.append(f"Severe thrombocytopenia (PLT {features.platelet_count})")
    elif features.platelet_count and features.platelet_count < 100:
        score += 6
        factors.append(f"Thrombocytopenia (PLT {features.platelet_count})")

    # Clamp score to 0-100
    risk_score = min(int(score), 100)

    # Determine risk level
    if risk_score >= 75:
        risk_level = "critical"
        action = "Immediate ICU admission required — activate emergency protocol"
    elif risk_score >= 50:
        risk_level = "high"
        action = "Urgent ICU assessment recommended — continuous monitoring"
    elif risk_score >= 25:
        risk_level = "moderate"
        action = "Close monitoring advised — reassess within 2 hours"
    else:
        risk_level = "low"
        action = "Standard ward care — routine monitoring"

    confidence = min(0.65 + (len(factors) * 0.03), 0.95)

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "recommended_action": action,
        "contributing_factors": factors[:8],
        "confidence": round(confidence, 2),
    }


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "PulseGrid AI Risk Intelligence",
        "model_loaded": model is not None,
    }


@app.post("/predict-risk", response_model=RiskPrediction)
async def predict_risk(features: PatientFeatures):
    """Predict mortality risk from patient features."""
    try:
        if model is not None:
            # Use XGBoost model
            feature_array = np.array([[
                features.age, features.heart_rate, features.systolic_bp,
                features.diastolic_bp, features.respiratory_rate,
                features.temperature, features.spo2, features.gcs_score,
                features.blood_glucose or 120, features.creatinine or 1.0,
                features.lactate or 1.0, features.wbc_count or 7.5,
                features.platelet_count or 250,
                float(features.is_ventilated or False),
                float(features.is_on_vasopressors or False),
            ]])
            dmatrix = xgb.DMatrix(feature_array)
            raw_score = float(model.predict(dmatrix)[0])
            risk_score = min(int(raw_score * 100), 100)

            if risk_score >= 75:
                risk_level = "critical"
                action = "Immediate ICU admission required — activate emergency protocol"
            elif risk_score >= 50:
                risk_level = "high"
                action = "Urgent ICU assessment recommended — continuous monitoring"
            elif risk_score >= 25:
                risk_level = "moderate"
                action = "Close monitoring advised — reassess within 2 hours"
            else:
                risk_level = "low"
                action = "Standard ward care — routine monitoring"

            return RiskPrediction(
                risk_score=risk_score,
                risk_level=risk_level,
                recommended_action=action,
                contributing_factors=["ML model prediction"],
                confidence=0.92,
            )
        else:
            # Fallback to heuristic engine
            result = heuristic_risk_score(features)
            return RiskPrediction(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/batch-predict")
async def batch_predict(patients: list[PatientFeatures]):
    """Batch predict risk for multiple patients."""
    results = []
    for patient in patients:
        try:
            result = heuristic_risk_score(patient)
            results.append(result)
        except Exception as e:
            results.append({"error": str(e)})
    return {"predictions": results, "count": len(results)}
