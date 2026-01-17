const { ObjectId } = require('mongodb');
const { getDB } = require('../database');
const User = require('../model/User');
const jwt = require('jsonwebtoken');

// Generate JWT token
const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Register new user
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    const errors = User.validate({ username, email, password });
    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors 
      });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    // Check if user already exists
    const existingUser = await usersCollection.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'User with this email or username already exists' 
      });
    }

    // Hash password
    const hashedPassword = await User.hashPassword(password);

    // Create new user
    const newUser = new User({
      username,
      email: email.toLowerCase(),
      password: hashedPassword
    });

    const result = await usersCollection.insertOne(newUser);

    // Generate token
    const token = generateToken(result.insertedId, newUser.email);

    // Return sanitized user data
    const sanitizedUser = User.sanitize({
      _id: result.insertedId,
      ...newUser
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: sanitizedUser,
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error registering user',
      error: error.message 
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required' 
      });
    }

    const db = getDB();
    const usersCollection = db.collection('users');

    // Find user by email
    const user = await usersCollection.findOne({ 
      email: email.toLowerCase() 
    });

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Check password
    const isValidPassword = await User.comparePassword(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Generate token
    const token = generateToken(user._id, user.email);

    // Return sanitized user data
    const sanitizedUser = User.sanitize(user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: sanitizedUser,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error logging in',
      error: error.message 
    });
  }
};

// Get current user (protected route)
const getCurrentUser = async (req, res) => {
  try {
    const db = getDB();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ 
      _id: new ObjectId(req.user.userId) 
    });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const sanitizedUser = User.sanitize(user);

    res.status(200).json({
      success: true,
      data: sanitizedUser
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching user',
      error: error.message 
    });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
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

    const user = await usersCollection.findOne({ 
      _id: new ObjectId(userId) 
    });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    const sanitizedUser = User.sanitize(user);

    res.status(200).json({
      success: true,
      data: sanitizedUser
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching user',
      error: error.message 
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  getUserById
};