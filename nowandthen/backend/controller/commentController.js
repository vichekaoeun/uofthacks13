const { ObjectId } = require('mongodb');
const { getDB } = require('../database');

exports.getComments = async (req, res) => {
  try {
    const { lat, lon, radius = 500, userId, requestingUserId } = req.query;
    
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
    
    // Get the requesting user's friend list if provided
    let friendIds = [];
    if (requestingUserId) {
      const requestingUser = await db.collection('users').findOne(
        { _id: new ObjectId(requestingUserId) },
        { projection: { friends: 1 } }
      );
      
      if (requestingUser && requestingUser.friends) {
        friendIds = requestingUser.friends.map(id => id.toString());
      }
    }
    
    // Process comments to show names only for friends
    const processedComments = comments.map(comment => {
      const commentUserIdStr = comment.userId.toString();
      const isFriend = friendIds.includes(commentUserIdStr);
      const isOwnComment = requestingUserId && commentUserIdStr === requestingUserId;
      
      return {
        ...comment,
        displayUsername: (isFriend || isOwnComment) ? comment.username : 'anonymous'
      };
    });
    
    res.json(processedComments);
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

    if (!text && !mediaUrl) {
      return res.status(400).json({ error: 'text or mediaUrl is required' });
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

exports.uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file is required' });
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    res.status(201).json({
      url: fileUrl,
      fileName: req.file.filename,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};