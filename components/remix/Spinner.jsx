import React, { useEffect, useState } from "react";
import "../css/Dashboard.css"; // Keep your existing CSS
import "../css/Spinner.css";   // Keep your existing CSS
import axios from "axios";
import { Loader2, RotateCw } from 'lucide-react';

// IMPORTANT: Placeholder for your actual Spinner Wheel visual component.
// You MUST replace this with a real library (e.g., 'react-roulette-wheel',
// 'react-spinning-wheel') or your custom SVG/Canvas implementation.
// This component currently just displays options as text.
const SpinnerWheelVisual = ({ options, onSpinComplete, selectedOptionLabel, isSpinning }) => {
    // In a real scenario, this component would render the wheel.
    // 'options' would be used to draw the segments.
    // 'selectedOptionLabel' (or value/index) would guide the animation to the result.
    // 'onSpinComplete' would be called when the animation finishes.

    useEffect(() => {
        if (isSpinning) {
            // Simulate a visual spin animation duration
            const spinDuration = 3000; // 3 seconds for demonstration
            const timer = setTimeout(() => {
                if (onSpinComplete) {
                    onSpinComplete();
                }
            }, spinDuration);
            return () => clearTimeout(timer);
        }
    }, [isSpinning, onSpinComplete]);


    return (
        <div className="spinner-visual-area">
            {options.length > 0 ? (
                <div className="spinner-options-list">
                    <h3 className="options-heading">Wheel Options:</h3>
                    <ul className="options-ul">
                        {options.map((option, index) => (
                            <li key={index} style={{ color: option.color || '#333' }}>
                                {option.label} {option.weight && `(Weight: ${option.weight})`}
                            </li>
                        ))}
                    </ul>
                    {selectedOptionLabel && !isSpinning && ( // Only show result when not spinning
                        <h3 className="spin-result-display">
                            Spun Result: <span className="result-label">{selectedOptionLabel}</span>
                        </h3>
                    )}
                     {isSpinning && (
                        <div className="spinning-indicator">
                            <RotateCw className="animate-spin" size={32} />
                            <p>Wheel is spinning...</p>
                        </div>
                    )}
                </div>
            ) : (
                <p className="no-options-message">Select a spinner wheel to see its options.</p>
            )}
             <p className="visual-note">
                (A sophisticated visual wheel animation would replace this area.)
            </p>
        </div>
    );
};


const Spinner = () => {
    const [currentUserData, setCurrentUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // New states for spinner functionality
    const [spinnerTemplates, setSpinnerTemplates] = useState([]); // List of available templates (name, id)
    const [selectedSpinnerWheel, setSelectedSpinnerWheel] = useState(null); // Full details of the selected wheel
    const [spinResult, setSpinResult] = useState(null); // Result of the last spin
    const [isSpinning, setIsSpinning] = useState(false); // To manage spin animation and button state

    const API_BASE_URL = import.meta.env.VITE_API_BASE; // Use your Vite environment variable

    // Helper to get auth token
    const getAuthToken = () => localStorage.getItem("token");
    const getUserId = () => localStorage.getItem("Id");

    // Combined useEffect for fetching user data and spinner templates
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            const token = getAuthToken();
            const id = getUserId();

            if (!token || !id) {
                setError("Authentication token or user ID not found. Please log in.");
                setLoading(false);
                return;
            }

            try {
                // 1. Fetch current user data
                const userResponse = await axios.get(
                    `${API_BASE_URL}/api/users/users/${id}`,
                    {
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );
                if (userResponse.status !== 200) {
                    throw new Error(`Failed to fetch current user data: ${userResponse.statusText}`);
                }
                setCurrentUserData(userResponse.data);

                // 2. Fetch available spinner wheel templates
                const templatesResponse = await axios.get(`${API_BASE_URL}/api/spinner-wheels`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                setSpinnerTemplates(templatesResponse.data);

            } catch (err) {
                console.error("Error fetching data:", err);
                setError(err.response?.data?.message || err.message || "Failed to load data. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []); // Runs once on component mount

    // Handle selection of a spinner wheel from the dropdown
    const handleSelectSpinnerWheel = async (event) => {
        const wheelId = event.target.value;
        if (!wheelId) {
            setSelectedSpinnerWheel(null);
            setSpinResult(null); // Clear previous spin result if no wheel is selected
            return;
        }

        setLoading(true); // Indicate loading for wheel details
        setError(null);
        setSpinResult(null); // Clear previous spin result

        try {
            const token = getAuthToken();
            const response = await axios.get(`${API_BASE_URL}/api/spinner-wheels/${wheelId}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            setSelectedSpinnerWheel(response.data);
        } catch (err) {
            console.error('Error fetching selected spinner wheel:', err);
            setError(err.response?.data?.message || err.message || 'Failed to fetch spinner wheel details.');
            setSelectedSpinnerWheel(null); // Clear selection on error
        } finally {
            setLoading(false); // End loading for wheel details
        }
    };

    // Handle the "Spin" action
    const handleSpin = async () => {
        if (!selectedSpinnerWheel) {
            setError('Please select a spinner wheel first.');
            return;
        }

        setIsSpinning(true); // Start spinning animation
        setSpinResult(null); // Clear previous result
        setError(null);

        try {
            const token = getAuthToken();
            const response = await axios.post(
                `${API_BASE_URL}/api/spinner-wheels/${selectedSpinnerWheel._id}/spin`,
                {}, // Empty body for POST request
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );
            // The result from the backend is immediately available,
            // but we'll use the SpinnerWheelVisual's onSpinComplete
            // to set isSpinning to false after its simulated animation.
            setSpinResult(response.data.selectedOption);

        } catch (err) {
            console.error('Error spinning wheel:', err);
            setError(err.response?.data?.message || err.message || 'Failed to spin the wheel.');
            setIsSpinning(false); // Stop spinning immediately on error
        }
        // setIsSpinning(false) is now handled by SpinnerWheelVisual's useEffect
    };

    if (loading) {
        return (
            <div className="dashboard-container loading-state">
                <p>Loading user data and spinner wheels...</p>
                <Loader2 className="animate-spin" size={32} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-container error-state">
                <p className="error-message">{error}</p>
            </div>
        );
    }

    if (!currentUserData) {
        return (
            <div className="dashboard-container no-data-state">
                <p>No user data found. Please log in.</p>
            </div>
        );
    }

    return (
        <>
            <div className="child">
                <h1 id="dashboard-heading">
                    {currentUserData.role.toUpperCase()} DASHBOARD
                </h1>

                <div className="user-profile">
                    <div className="user-profile-details" id="dashboardInfo">
                        <p className="user-info">
                            <strong>Name:</strong> {currentUserData.name}
                        </p>
                        <p className="user-info">
                            <strong>Email:</strong> {currentUserData.email}
                        </p>
                        <p className="user-info">
                            <strong>Role:</strong> {currentUserData.role.toUpperCase()}
                        </p>
                        {currentUserData.collegeName && (
                            <p className="user-info">
                                <strong>College:</strong> {currentUserData.collegeName}
                            </p>
                        )}
                    </div>
                </div>

                <div className="spinner-selection-container">
                    <label htmlFor="spinner-select" className="select-label">Choose a Spinner Wheel:</label>
                    <select
                        id="spinner-select"
                        onChange={handleSelectSpinnerWheel}
                        value={selectedSpinnerWheel ? selectedSpinnerWheel._id : ''}
                        disabled={loading || isSpinning} // Disable during loading or spinning
                        className="spinner-dropdown"
                    >
                        <option value="">-- Select a Wheel --</option>
                        {spinnerTemplates.map((template) => (
                            <option key={template._id} value={template._id}>
                                {template.name} ({template.type})
                            </option>
                        ))}
                    </select>
                </div>

                {selectedSpinnerWheel && (
                    <div className="selected-spinner-details">
                        <h2>{selectedSpinnerWheel.name}</h2>
                        <p className="spinner-description">{selectedSpinnerWheel.description}</p>
                        <p className="spinner-type">Type: {selectedSpinnerWheel.type}</p>

                        <div className="spinner-visual-wrapper">
                            {/* The actual visual spinner component */}
                            <SpinnerWheelVisual
                                options={selectedSpinnerWheel.options}
                                onSpinComplete={() => setIsSpinning(false)}
                                selectedOptionLabel={spinResult ? spinResult.label : null}
                                isSpinning={isSpinning}
                            />
                        </div>

                        <button
                            onClick={handleSpin}
                            disabled={isSpinning || loading || !selectedSpinnerWheel}
                            className="spin-button"
                        >
                            {isSpinning ? (
                                <>
                                    <RotateCw size={20} className="animate-spin button-icon" /> Spinning...
                                </>
                            ) : (
                                <>
                                    <RotateCw size={20} className="button-icon" /> Spin the Wheel!
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

export default Spinner;