const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
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
    
    // Resolve requesting user id from query or Authorization header
    let effectiveRequestingUserId = requestingUserId;
    if (!effectiveRequestingUserId) {
      const authHeader = req.header('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded?.userId) {
            effectiveRequestingUserId = decoded.userId;
          }
        } catch (_err) {
          // ignore invalid token for public comments feed
        }
      }
    }

    // Get the requesting user's friend list if provided
    let friendIds = [];
    if (effectiveRequestingUserId) {
      const requestingUser = await db.collection('users').findOne(
        { _id: new ObjectId(effectiveRequestingUserId) },
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
      const isOwnComment = effectiveRequestingUserId && commentUserIdStr === effectiveRequestingUserId;

      const likedBy = Array.isArray(comment.likedBy) ? comment.likedBy : [];
      const likedByMe = effectiveRequestingUserId
        ? likedBy.some(id => id.toString() === effectiveRequestingUserId)
        : false;
      
      return {
        ...comment,
        displayUsername: (isFriend || isOwnComment) ? comment.username : 'anonymous',
        likedByMe
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
      likedBy: [],
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

exports.toggleLike = async (req, res) => {
  try {
    const { commentId } = req.params;
    if (!ObjectId.isValid(commentId)) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID' });
    }

    const userId = req.user?.userId;
    if (!userId || !ObjectId.isValid(userId)) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const db = getDB();
    const commentsCollection = db.collection('comments');
    const commentObjectId = new ObjectId(commentId);
    const userObjectId = new ObjectId(userId);

    // Try like (only if not already liked)
    const likeResult = await commentsCollection.updateOne(
      { _id: commentObjectId, likedBy: { $ne: userObjectId } },
      { $addToSet: { likedBy: userObjectId }, $inc: { likes: 1 } }
    );

    if (likeResult.matchedCount === 1) {
      const updated = await commentsCollection.findOne(
        { _id: commentObjectId },
        { projection: { likes: 1, likedBy: 1 } }
      );
      return res.json({ likes: updated?.likes ?? 0, liked: true });
    }

    // Otherwise unlike
    await commentsCollection.updateOne(
      { _id: commentObjectId, likedBy: userObjectId },
      { $pull: { likedBy: userObjectId }, $inc: { likes: -1 } }
    );

    // Clamp to zero just in case
    await commentsCollection.updateOne(
      { _id: commentObjectId, likes: { $lt: 0 } },
      { $set: { likes: 0 } }
    );

    const updated = await commentsCollection.findOne(
      { _id: commentObjectId },
      { projection: { likes: 1, likedBy: 1 } }
    );

    return res.json({ likes: updated?.likes ?? 0, liked: false });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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