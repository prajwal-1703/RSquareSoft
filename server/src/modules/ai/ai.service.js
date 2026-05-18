/**
 * PulseGrid AI — AI Risk Intelligence Service
 * Node.js client for FastAPI inference microservice
 */

const config = require('../../config');
const logger = require('../../utils/logger');

class AiService {
  constructor() {
    this.baseUrl = config.ai.serviceUrl;
  }

  async predictRisk(vitals) {
    try {
      const payload = {
        age: 50, // Will be enriched with patient age in production
        heart_rate: vitals.heartRate || 80,
        systolic_bp: vitals.systolicBp || 120,
        diastolic_bp: vitals.diastolicBp || 80,
        respiratory_rate: vitals.respiratoryRate || 16,
        temperature: vitals.temperature || 37.0,
        spo2: vitals.spo2 || 98,
        gcs_score: vitals.gcsScore || 15,
        blood_glucose: vitals.bloodGlucose || 100,
        creatinine: vitals.creatinine || 1.0,
        lactate: vitals.lactate || 1.0,
        wbc_count: vitals.wbcCount || 7.5,
        platelet_count: vitals.plateletCount || 250,
        is_ventilated: vitals.isVentilated || false,
        is_on_vasopressors: vitals.isOnVasopressors || false,
      };

      const response = await fetch(`${this.baseUrl}/predict-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`AI service responded with ${response.status}`);
      }

      const prediction = await response.json();
      logger.debug(`[AI] Prediction: risk_score=${prediction.risk_score}, level=${prediction.risk_level}`);
      return prediction;
    } catch (err) {
      logger.warn(`[AI] Service unavailable, using fallback: ${err.message}`);
      return this._fallbackPrediction(vitals);
    }
  }

  async batchPredict(patientsVitals) {
    try {
      const response = await fetch(`${this.baseUrl}/batch-predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patientsVitals),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) throw new Error(`Batch predict failed: ${response.status}`);
      return await response.json();
    } catch (err) {
      logger.warn(`[AI] Batch predict failed: ${err.message}`);
      return { predictions: [], count: 0 };
    }
  }

  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  _fallbackPrediction(vitals) {
    let score = 30;
    if (vitals.spo2 && vitals.spo2 < 90) score += 25;
    if (vitals.systolicBp && vitals.systolicBp < 90) score += 20;
    if (vitals.heartRate && (vitals.heartRate > 130 || vitals.heartRate < 40)) score += 15;
    if (vitals.gcsScore && vitals.gcsScore <= 8) score += 25;
    score = Math.min(score, 100);

    return {
      risk_score: score,
      risk_level: score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low',
      recommended_action: score >= 75 ? 'Immediate ICU Required' : 'Monitor closely',
      contributing_factors: ['Fallback heuristic (AI service unavailable)'],
      confidence: 0.5,
    };
  }
}

module.exports = new AiService();
