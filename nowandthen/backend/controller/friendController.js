const { ObjectId } = require('mongodb');
const { getDB } = require('../database');

// Search users by username
const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    const users = await usersCollection
      .find({
        username: { $regex: query, $options: 'i' }
      })
      .project({ password: 0 })
      .limit(20)
      .toArray();

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching users',
      error: error.message
    });
  }
};

// Send friend request
const sendFriendRequest = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const senderId = req.user.userId;

    if (!recipientId || !ObjectId.isValid(recipientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid recipient ID'
      });
    }

    if (senderId === recipientId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send friend request to yourself'
      });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    const recipientObjectId = new ObjectId(recipientId);
    const senderObjectId = new ObjectId(senderId);

    // Check if recipient exists
    const recipient = await usersCollection.findOne({ _id: recipientObjectId });
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already friends
    if (recipient.friends && recipient.friends.some(id => id.toString() === senderId)) {
      return res.status(400).json({
        success: false,
        message: 'Already friends with this user'
      });
    }

    // Check if request already sent
    if (recipient.friendRequests && recipient.friendRequests.some(id => id.toString() === senderId)) {
      return res.status(400).json({
        success: false,
        message: 'Friend request already sent'
      });
    }

    // Add to recipient's friend requests
    await usersCollection.updateOne(
      { _id: recipientObjectId },
      { $push: { friendRequests: senderObjectId } }
    );

    res.status(200).json({
      success: true,
      message: 'Friend request sent successfully'
    });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending friend request',
      error: error.message
    });
  }
};

// Accept friend request
const acceptFriendRequest = async (req, res) => {
  try {
    const { senderId } = req.body;
    const userId = req.user.userId;

    if (!senderId || !ObjectId.isValid(senderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sender ID'
      });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    const userObjectId = new ObjectId(userId);
    const senderObjectId = new ObjectId(senderId);

    // Check if friend request exists
    const user = await usersCollection.findOne({ _id: userObjectId });
    if (!user || !user.friendRequests || !user.friendRequests.some(id => id.toString() === senderId)) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found'
      });
    }

    // Add each other as friends
    await usersCollection.updateOne(
      { _id: userObjectId },
      {
        $push: { friends: senderObjectId },
        $pull: { friendRequests: senderObjectId }
      }
    );

    await usersCollection.updateOne(
      { _id: senderObjectId },
      { $push: { friends: userObjectId } }
    );

    res.status(200).json({
      success: true,
      message: 'Friend request accepted'
    });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error accepting friend request',
      error: error.message
    });
  }
};

// Reject friend request
const rejectFriendRequest = async (req, res) => {
  try {
    const { senderId } = req.body;
    const userId = req.user.userId;

    if (!senderId || !ObjectId.isValid(senderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sender ID'
      });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    const userObjectId = new ObjectId(userId);
    const senderObjectId = new ObjectId(senderId);

    // Remove from friend requests
    await usersCollection.updateOne(
      { _id: userObjectId },
      { $pull: { friendRequests: senderObjectId } }
    );

    res.status(200).json({
      success: true,
      message: 'Friend request rejected'
    });
  } catch (error) {
    console.error('Reject friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting friend request',
      error: error.message
    });
  }
};

// Get friend requests
const getFriendRequests = async (req, res) => {
  try {
    const userId = req.user.userId;
    const db = getDB();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get details of users who sent friend requests
    const friendRequests = user.friendRequests || [];
    const requestDetails = await usersCollection
      .find({ _id: { $in: friendRequests } })
      .project({ password: 0 })
      .toArray();

    res.status(200).json({
      success: true,
      data: requestDetails
    });
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching friend requests',
      error: error.message
    });
  }
};

// Get friends list
const getFriends = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get details of friends
    const friends = user.friends || [];
    const friendDetails = await usersCollection
      .find({ _id: { $in: friends } })
      .project({ password: 0 })
      .toArray();

    res.status(200).json({
      success: true,
      data: friendDetails
    });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching friends',
      error: error.message
    });
  }
};

// Remove friend
const removeFriend = async (req, res) => {
  try {
    const { friendId } = req.body;
    const userId = req.user.userId;

    if (!friendId || !ObjectId.isValid(friendId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid friend ID'
      });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    const userObjectId = new ObjectId(userId);
    const friendObjectId = new ObjectId(friendId);

    // Remove friend from both users
    await usersCollection.updateOne(
      { _id: userObjectId },
      { $pull: { friends: friendObjectId } }
    );

    await usersCollection.updateOne(
      { _id: friendObjectId },
      { $pull: { friends: userObjectId } }
    );

    res.status(200).json({
      success: true,
      message: 'Friend removed successfully'
    });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing friend',
      error: error.message
    });
  }
};

module.exports = {
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriendRequests,
  getFriends,
  removeFriend
};
