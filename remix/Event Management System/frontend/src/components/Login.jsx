import { useEffect, useState } from 'react';
import axios from 'axios';
import '../css/Login.css';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  useEffect(() => {
    console.log(import.meta.env.VITE_API_BASE, "This is api checking");
  }, []);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const userData = {
      email: formData.email.toLowerCase(),
      password: formData.password
    };

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_BASE}/api/auth/login`, userData);
      
      console.log(`data: ${response.data}`);
      
      // Store user data in localStorage
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('role', response.data.role);
      localStorage.setItem('Id', response.data._id); //_id - ideal for mongoose 
      
      // Redirect to dashboard
    
      navigate('/dashboard');
    } catch (error) {
      console.error('Error logging in:', error);
      
      // Display error message
      if (error.response && error.response.data) {
        alert(error.response.data.message || 'Login failed');
      } else {
        alert('An error occurred during login.');
      }
      // This code checks if a login error has a server response(backend error basically) with data. If yes, it shows the server's specific error message; otherwise, it displays a generic "Login failed" alert. If there's no server response or data, it shows a general "An error occurred during login." alert.

      
      // Reload login page
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className='login-body'>
    <div className="login-container ">
      <h1>Log In</h1>
      <form id="loginForm" onSubmit={handleSubmit}>
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
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Log In'}
        </button>
        <p>Don't have an account? 
        <Link to="/signup">Sign Up</Link>
        </p>
      </form>
    </div>
    </div>
    </>
  );
};

export default Login;