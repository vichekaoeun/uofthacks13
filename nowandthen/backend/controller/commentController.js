const { ObjectId } = require('mongodb');
const { getDB } = require('../database');

exports.getComments = async (req, res) => {
  try {
    const { lat, lon, radius = 500, userId } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }
    
    const db = getDB();
    const query = {
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lon), parseFloat(lat)]
          },
          $maxDistance: parseInt(radius)
        }
      }
    };
    
    if (userId) {
      query.userId = new ObjectId(userId);
    }
    
    const comments = await db.collection('comments')
      .find(query)
      .limit(50)
      .toArray();
    
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createComment = async (req, res) => {
  try {
    const { userId, username, lon, lat, text, contentType = 'text', mediaUrl, coreLocationFlag, coreLocationName } = req.body;
    
    if (!userId || !username || !lon || !lat) {
      return res.status(400).json({ error: 'userId, username, lon, and lat are required' });
    }
    
    const db = getDB();
    const comment = {
      userId: new ObjectId(userId),
      username,
      location: {
        type: 'Point',
        coordinates: [parseFloat(lon), parseFloat(lat)]
      },
      contentType,
      content: {
        text: text || null,
        mediaUrl: mediaUrl || null,
        thumbnailUrl: null
      },
      coreLocation: coreLocationFlag ? {
        flag: coreLocationFlag,
        name: coreLocationName || 'Unknown Location',
        coordinates: [parseFloat(lon), parseFloat(lat)]
      } : null,
      createdAt: new Date(),
      expiresAt: null,
      isPublic: true,
      likes: 0,
      trailId: null,
      sequenceNumber: null
    };
    
    const result = await db.collection('comments').insertOne(comment);
    
    res.status(201).json({ 
      _id: result.insertedId,
      ...comment
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};