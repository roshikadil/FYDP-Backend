const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const dropSeqIdIndex = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const collection = mongoose.connection.db.collection('incidents');
    
    // Check if index exists
    const indexes = await collection.indexes();
    const hasSeqIdIndex = indexes.some(idx => idx.name === 'seqId_1' || idx.key.seqId);

    if (hasSeqIdIndex) {
      console.log('🔍 Found seqId index, dropping it...');
      await collection.dropIndex('seqId_1');
      console.log('✅ Successfully dropped seqId_1 index');
    } else {
      console.log('ℹ️ No seqId index found');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

dropSeqIdIndex();
