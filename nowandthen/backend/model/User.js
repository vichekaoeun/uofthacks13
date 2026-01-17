const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');

class User {
  constructor(data) {
    this.username = data.username;
    this.email = data.email;
    this.password = data.password;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Validate user data
  static validate(data) {
    const errors = [];

    // Username validation
    if (!data.username || data.username.trim().length === 0) {
      errors.push('Username is required');
    } else if (data.username.length < 3) {
      errors.push('Username must be at least 3 characters long');
    } else if (data.username.length > 30) {
      errors.push('Username must be less than 30 characters');
    }

    // Email validation
    if (!data.email || data.email.trim().length === 0) {
      errors.push('Email is required');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        errors.push('Invalid email format');
      }
    }

    // Password validation
    if (!data.password || data.password.length === 0) {
      errors.push('Password is required');
    } else if (data.password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    return errors;
  }

  // Hash password before saving
  static async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }

  // Compare password for login
  static async comparePassword(candidatePassword, hashedPassword) {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  }

  // Create user object without sensitive data
  static sanitize(user) {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}

module.exports = User;
