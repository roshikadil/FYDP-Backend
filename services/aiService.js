const axios = require('axios');
const FormData = require('form-data');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

/**
 * Service to handle communication with the KHIVISION AI model
 */
class AIService {
  constructor() {
    this.aiModelUrl = process.env.AI_MODEL_URL || 'http://localhost:5005/detect';
    this.bucketName = 'uploads';
  }

  /**
   * Detect accident in an image stored in GridFS
   * @param {string} filename GridFS filename
   * @returns {Promise<Object>} Detection results including score
   */
  async detectAccident(filename) {
    try {
      console.log(`🤖 AI: Analyzing photo ${filename} at ${this.aiModelUrl}`);
      
      const db = mongoose.connection.db;
      if (!db) throw new Error('Database not connected');

      const bucket = new GridFSBucket(db, { bucketName: this.bucketName });
      
      // 1. Fetch file from GridFS as buffer
      const buffer = await this._getFileBuffer(bucket, filename);
      
      // If using Hugging Face Spaces Gradio interface
      if (this.aiModelUrl.includes('hf.space')) {
        try {
          const { Client } = await import('@gradio/client');
          // Extract workspace name from URL (e.g. roshikk-khivision-accident-detector.hf.space -> roshikk/khivision-accident-detector)
          // Actually, we can just connect to the URL directly if we format it right, or hardcode the space name
          const spaceName = "roshikk/khivision-accident-detector"; 
          const client = await Client.connect(spaceName);
          
          const blob = new Blob([buffer], { type: 'image/jpeg' });
          const response = await client.predict("/predict_accident", { image: blob });
          
          // Gradio returns string: "Status: ACCIDENT\nConfidence Score: 85.00%"
          const resultText = response.data[1] || "";
          
          let score = 0;
          let status = 'UNKNOWN';
          
          const statusMatch = resultText.match(/Status:\s*([^\n]+)/);
          if (statusMatch) status = statusMatch[1].trim();
          
          const scoreMatch = resultText.match(/Confidence Score:\s*([\d.]+)/);
          if (scoreMatch) score = parseFloat(scoreMatch[1]);

          console.log(`✅ AI: Analysis complete for ${filename}. Score: ${score}`);
          
          return {
            success: true,
            score: score,
            status: status,
            details: resultText
          };
        } catch (gradioErr) {
          console.error("Gradio API Error:", gradioErr);
          throw gradioErr;
        }
      }

      // 2. Prepare multipart form data (for local Flask/FastAPI backend)
      const form = new FormData();
      form.append('image', buffer, { 
        filename: filename,
        contentType: 'image/jpeg'
      });

      // 3. Send to AI model
      const response = await axios.post(this.aiModelUrl, form, {
        headers: {
          ...form.getHeaders(),
        },
        timeout: 10000 // 10 second timeout for AI processing
      });

      console.log(`✅ AI: Analysis complete for ${filename}. Score: ${response.data.score}`);
      
      return {
        success: true,
        score: response.data.score || 0,
        status: response.data.status || 'UNKNOWN',
        details: response.data
      };
    } catch (error) {
      console.error('❌ AI Service Error:', error.message);
      if (error.response) {
        console.error('AI Model returned error:', error.response.data);
      }
      
      // Return a safe failure object
      return {
        success: false,
        score: 0,
        status: 'ERROR',
        error: error.message
      };
    }
  }

  /**
   * Helper to convert GridFS stream to Buffer
   */
  async _getFileBuffer(bucket, filename) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      const downloadStream = bucket.openDownloadStreamByName(filename);
      
      downloadStream.on('data', chunk => chunks.push(chunk));
      downloadStream.on('error', reject);
      downloadStream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}

module.exports = new AIService();
