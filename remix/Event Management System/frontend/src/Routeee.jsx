import React from 'react'
import { BrowserRouter as Router, Routes, Route, BrowserRouter } from "react-router-dom";
import Signup from './components/Signup';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AudioEditor from './components/AudioEditor';
import Spinner from './components/Spinner'

const Routeing = () => {
  return (
    <>
    {/* <BrowserRouter> */}
       <Router>
        <Routes>
          <Route path="/" element={<Signup />} />
           {/* <Route path="/" element={<Remix />} /> */}
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/:id" element={<AudioEditor />} />
          <Route path="/dashboard/spinner/:id" element={<Spinner/>} />

        </Routes>
      </Router>
      {/* </BrowserRouter> */}
    </>
  )
}

export default Routeing
