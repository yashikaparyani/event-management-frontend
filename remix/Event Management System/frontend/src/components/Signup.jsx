import { useState } from 'react';
import axios from 'axios';
import '../css/Signup.css'
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';


const SignUp = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
    collegeName: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target; //destructing to find the value in the input field.
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const validateForm = () => {
    // Name validation
    if (formData.name.trim().length < 3) {
      setError('Name must be at least 3 characters long.');
      return false;
    }

    // Email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      setError('Email is not valid. Try again!');
      return false;
    }

    // Password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      setError(
        'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.'
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    // Prepare data for API call
    const userData = {
      name: formData.name.trim().toLowerCase(),
      email: formData.email.trim().toLowerCase(),
      password: formData.password,  // Keep password case-sensitive
      role: formData.role.toLowerCase(),
      collegeName: formData.collegeName.trim().toLowerCase()
    };

    try {
      setLoading(true);
      const response = await axios.post('http://localhost:3000/api/auth/signup', userData);
      
      alert(response.data.message); // data is an object property. 
      window.location.href = '/login'; // Redirect to login page
    } catch (error) {
      console.error('Error signing up:', error);
      
      if (error.response && error.response.data) {
        setError(error.response.data.message || 'Signup failed. Please try again.');
      } else {
        setError('An error occurred during signup. Please try again later.');
      }
        navigate('/signup');

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <h1>Sign Up</h1>
      
      {error && <div className="error-message">{error}</div>}
      
      <form id="signupForm" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name:</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>
        {/* htmlFor attribute and id must be must of the label and input */}
        <div className="form-group">
          <label htmlFor="role">Roles:</label>
          
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            required
          >
            <option value="" disabled>-- Please Select --</option>
            <option value="rgpv">RGPV</option>
            <option value="college">College</option>
            <option value="director">Director</option>
            <option value="hod">HOD</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="collegeName">College Name (if applicable):</label>
          <input
            type="text"
            id="collegeName"
            name="collegeName"
            value={formData.collegeName}
            onChange={handleChange}
          />
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Signing Up...' : 'Sign Up'}
        </button>
        
        <p>
          Already have an account? <Link to="/login">Log In</Link>
        </p>
      </form>
    </div>
    // link is used instead of a <a> tag in html.
  );
};

export default SignUp;