import {
  Upload, Play, Pause, ChevronDown, ZoomIn, ZoomOut, Plus, Minus, Download,
  Trash2, Combine, Volume2, SquarePlus, Scissors, Copy, ClipboardPaste,
  VolumeX, PlusCircle, Crop, Split, Signal, SignalLow, X, Save, RotateCcw,
  Rewind, SkipForward, SkipBack   // Import Rewind icon
} from "lucide-react";
import React, { useEffect, useState, useRef, useCallback } from "react";
import "../css/AudioEditor.css";
import "../css/Dashboard.css";
import axios from "axios";
import WaveSurfer from 'wavesurfer.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';

const AudioEditor = () => {
  const [currentUserData, setCurrentUserData] = useState(null);
  const [audioFiles, setAudioFiles] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedAudioFiles, setSelectedAudioFiles] = useState([]);
  const [activeAudioFile, setActiveAudioFile] = useState(null);

  const [selectedRegions, setSelectedRegions] = useState(new Map()); // Map of fileId -> regionId

  const fileInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // ✅ ADD THESE TWO NEW useRef DECLARATIONS HERE:
  const volumeTimeoutRef = useRef(null);
  const lastAppliedVolumeRef = useRef(1);

  const wavesurferInstances = useRef(new Map());
  const audioBlobUrls = useRef(new Map());

  const [currentZoomLevel, setCurrentZoomLevel] = useState(1);

  const [playbackVolume, setPlaybackVolume] = useState(1); // For WaveSurfer (0-1 range)
  const [processingVolume, setProcessingVolume] = useState(1); // For backend (0-2 range)


  // State for new operations
  const [fadeDuration, setFadeDuration] = useState(2); // Default 2 seconds
  const [insertPosition, setInsertPosition] = useState(0); // Default to start of file
  const [sourceAudioFileIdForInsert, setSourceAudioFileIdForInsert] = useState('');
  const [sourceRegionForInsert, setSourceRegionForInsert] = useState({ startTime: 0, endTime: 0 }); // Optional
  const [splitPosition, setSplitPosition] = useState(0); // For single split point for simplicity
  const [concatSourceFileIds, setConcatSourceFileIds] = useState([]); // For concatenate/merge
  const [volume, setVolume] = useState(1);

  const [fadePreview, setFadePreview] = useState({ type: null, duration: null, fileId: null });
  const fadeOverlayRef = useRef(new Map());


  // --- Utility Functions ---
  const fetchAudioFiles = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found.');
        return;
      }
      const response = await axios.get('https://event-management-backend-z0ty.onrender.com/api/audio/files', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setAudioFiles(response.data.data);
    } catch (error) {
      console.error('Error fetching audio files:', error);
    }
  }, []);

  const fetchBlobAndRenderWaveform = useCallback(async (file, wsInstance) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`https://event-management-backend-z0ty.onrender.com/api/audio/files/${file._id}/stream`, {
        responseType: 'blob',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const blob = new Blob([response.data], { type: file.mimeType });
      const blobUrl = URL.createObjectURL(blob);
      audioBlobUrls.current.set(file._id, blobUrl);

      wsInstance.load(blobUrl);
    } catch (error) {
      console.error('Error fetching audio blob or loading waveform:', error);
    }
  }, []);

  const initializeWaveSurfer = useCallback((file) => {
    if (wavesurferInstances.current.has(file._id)) {
      wavesurferInstances.current.get(file._id).destroy();
      wavesurferInstances.current.delete(file._id);
    }

    const ws = WaveSurfer.create({
      container: `#waveform-${file._id}`,
      waveColor: 'rgb(200, 0, 200)',
      progressColor: 'rgb(100, 0, 100)',
      url: file.fileUrl,
      minPxPerSec: currentZoomLevel * 50,
      plugins: [
        TimelinePlugin.create({
          container: `#waveform-timeline-${file._id}`,
          primaryLabelInterval: 10,
          secondaryLabelInterval: 1,
        }),
        RegionsPlugin.create(),
      ],
    });

    ws.on('ready', () => {
      console.log(`WaveSurfer for ${file.originalName} is ready.`);
      const duration = ws.getDuration();



      ws.setVolume(playbackVolume);

      // Update the file object with duration
      setSelectedAudioFiles(prevFiles =>
        prevFiles.map(f =>
          f._id === file._id ? { ...f, duration } : f
        )
      );

      if (file._id === activeAudioFile?._id) {
        setActiveAudioFile(prev => prev ? { ...prev, duration } : null);
      }
    });

    ws.on('error', (err) => console.error('WaveSurfer error:', err));

    ws.on('region-created', (region) => {
      console.log('Region created event:', region.id, 'for file:', file._id);
      setSelectedRegions(prev => {
        const newMap = new Map(prev);
        newMap.set(file._id, region.id);
        console.log('Region created - Updated selectedRegions:', newMap);
        return newMap;
      });
    });

    ws.on('region-clicked', (region, e) => {
      console.log('Region clicked event:', region.id, 'for file:', file._id);
      setSelectedRegions(prev => {
        const newMap = new Map(prev);
        newMap.set(file._id, region.id);
        console.log('Region clicked - Updated selectedRegions:', newMap);
        return newMap;
      });
    });

    ws.on('region-updated', (region) => {
      console.log('Region updated event:', region.id, 'for file:', file._id);
      setSelectedRegions(prev => {
        const newMap = new Map(prev);
        newMap.set(file._id, region.id);
        console.log('Region updated - Updated selectedRegions:', newMap);
        return newMap;
      });
    });


    wavesurferInstances.current.set(file._id, ws);
    fetchBlobAndRenderWaveform(file, ws);

  }, [currentZoomLevel, activeAudioFile, fetchBlobAndRenderWaveform, playbackVolume]);


  // --- Handlers for existing functionalities ---
  const handleUploadClick = () => fileInputRef.current.click();

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach(file => formData.append('audioFiles', file));

    try {
      const token = localStorage.getItem('token');
      await axios.post('https://event-management-backend-z0ty.onrender.com/api/audio/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });
      alert('Files uploaded successfully!');
      fetchAudioFiles(); // Refresh the list of audio files
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Error uploading files.');
    }
  };

  const handleSetAndManageActiveAudioFile = useCallback(async (file) => {
    if (activeAudioFile && wavesurferInstances.current.has(activeAudioFile._id)) {
      wavesurferInstances.current.get(activeAudioFile._id).stop();
    }

    setActiveAudioFile(file);
    // Just set the active file - WaveSurfer should already be initialized
  }, [activeAudioFile]);

  const handleDownloadActiveFile = async () => {
    if (!activeAudioFile) {
      alert("No active audio file to download.");
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`https://event-management-backend-z0ty.onrender.com/api/audio/download/${activeAudioFile._id}`, {
        responseType: 'blob', // Important for downloading files
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Create a blob URL and a temporary link to trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', activeAudioFile.originalName); // Use original name for download
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url); // Clean up the URL object
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file.');
    }
  };

  const handleDeleteActiveFile = async () => {
    if (!activeAudioFile || !window.confirm(`Are you sure you want to delete ${activeAudioFile.originalName}?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`https://event-management-backend-z0ty.onrender.com/api/audio/files/${activeAudioFile._id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      alert(`${activeAudioFile.originalName} deleted successfully.`);
      if (wavesurferInstances.current.has(activeAudioFile._id)) {
        wavesurferInstances.current.get(activeAudioFile._id).destroy();
        wavesurferInstances.current.delete(activeAudioFile._id);
      }
      setActiveAudioFile(null);
      setSelectedAudioFiles(prev => prev.filter(file => file._id !== activeAudioFile._id));
      fetchAudioFiles(); // Refresh the list
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file.');
    }
  };


  const handlePlayPause = () => {
    if (activeAudioFile && wavesurferInstances.current.has(activeAudioFile._id)) {
      wavesurferInstances.current.get(activeAudioFile._id).playPause();
    }
  };

  const handleSeekForward = () => {
    if (activeAudioFile && wavesurferInstances.current.has(activeAudioFile._id)) {
      const ws = wavesurferInstances.current.get(activeAudioFile._id);
      const currentTime = ws.getCurrentTime();
      const duration = ws.getDuration();
      const newTime = Math.min(currentTime + 5, duration);
      ws.seekTo(newTime / duration);
    }
  };

  const handleSeekBackward = () => {
    if (activeAudioFile && wavesurferInstances.current.has(activeAudioFile._id)) {
      const ws = wavesurferInstances.current.get(activeAudioFile._id);
      const currentTime = ws.getCurrentTime();
      const newTime = Math.max(currentTime - 5, 0);
      ws.seekTo(newTime / ws.getDuration());
    }
  };

  const handleStop = () => {
    if (activeAudioFile && wavesurferInstances.current.has(activeAudioFile._id)) {
      wavesurferInstances.current.get(activeAudioFile._id).stop();
    }
  };

  const handleZoom = (level) => {
    if (!activeAudioFile) {
      alert("Please select an active audio file to zoom.");
      return;
    }

    const newZoom = currentZoomLevel * level;
    setCurrentZoomLevel(newZoom);

    const activeWs = wavesurferInstances.current.get(activeAudioFile._id);
    if (activeWs) {
      try {
        activeWs.setOptions({ minPxPerSec: newZoom * 50 });
      } catch (error) {
        console.warn('Error applying zoom:', error);
      }
    }
  };

  const handleSelectAudioFile = (file) => {
    console.log("Selected file:", file.originalName);
    if (!selectedAudioFiles.some(f => f._id === file._id)) {
      setSelectedAudioFiles(prev => [...prev, file]);
      // initializeWaveSurfer(file);
    }
  };

  const handleRemoveSelectedWaveform = (fileIdToRemove) => {
    setSelectedAudioFiles(prev => prev.filter(file => file._id !== fileIdToRemove));
    if (wavesurferInstances.current.has(fileIdToRemove)) {
      wavesurferInstances.current.get(fileIdToRemove).destroy();
      wavesurferInstances.current.delete(fileIdToRemove);
    }
    if (activeAudioFile && activeAudioFile._id === fileIdToRemove) {
      setActiveAudioFile(null);
    }
    setSelectedRegions(prev => {
      const newMap = new Map(prev);
      newMap.delete(fileIdToRemove);
      return newMap;
    });
    const blobUrl = audioBlobUrls.current.get(fileIdToRemove);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      audioBlobUrls.current.delete(fileIdToRemove);
    }
  };

  // ✅ ADD THIS NEW FUNCTION HERE:
  // 3. Update the auto-apply function to use processingVolume
  const handleVolumeChangeWithAutoApply = (newVolume) => {
    // Clear existing timeout
    if (volumeTimeoutRef.current) {
      clearTimeout(volumeTimeoutRef.current);
    }

    // Set new timeout to apply volume after 2 seconds of no changes
    volumeTimeoutRef.current = setTimeout(async () => {
      if (activeAudioFile && newVolume !== lastAppliedVolumeRef.current && newVolume !== 1) {
        try {
          console.log(`Auto-applying volume change: ${newVolume}`);
          await sendSingleEditToBackend('volume_adjust', {
            volumeLevel: newVolume  // Send full range (0-2) to backend
          });
          lastAppliedVolumeRef.current = newVolume;
          console.log(`Volume applied successfully: ${newVolume}`);
        } catch (error) {
          console.error('Auto-apply volume failed:', error);
          alert(`Failed to apply volume change: ${error.message}`);
        }
      }
    }, 2000);
  };

  // Updated sendSingleEditToBackend function
  const sendSingleEditToBackend = async (operationType, operationData = {}) => {
    if (!activeAudioFile) {
      alert("Please select an active audio file for editing.");
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No authentication token found.');
      alert('Authentication required.');
      return;
    }

    try {
      console.log(`Sending operation ${operationType} with data:`, operationData);
      const response = await axios.post('https://event-management-backend-z0ty.onrender.com/api/audio/apply-single-edit', {
        targetAudioFileId: activeAudioFile._id,
        operationType,
        operationData,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log("Backend response:", response.data);
      alert(`Operation "${operationType}" applied successfully!`);

      // Clean up any fade previews for this file after successful operation
      if (['fade_in', 'fade_out'].includes(operationType)) {
        setTimeout(() => {
          removeFadeOverlay(activeAudioFile._id);
          setFadePreview({ type: null, duration: null, fileId: null });
        }, 1000); // Show the effect for 1 second before removing
      }

      const updatedFile = response.data.data.audioFile;
      if (updatedFile) {
        setSelectedAudioFiles(prevFiles =>
          prevFiles.map(file =>
            file._id === activeAudioFile._id ? { ...file, duration: updatedFile.duration } : file
          )
        );

        const updatedActiveFile = {
          ...activeAudioFile,
          duration: updatedFile.duration,
          fileSize: updatedFile.fileSize || activeAudioFile.fileSize,
          updatedAt: new Date()
        };

        // await handleSetAndManageActiveAudioFile(updatedActiveFile);
        await refreshActiveWaveform(updatedActiveFile);


        setSelectedRegions(new Map());

        if (wavesurferInstances.current.has(activeAudioFile._id)) {
          const ws = wavesurferInstances.current.get(activeAudioFile._id);
          const regionsPlugin = ws.plugins.find(plugin => plugin instanceof RegionsPlugin);
          if (regionsPlugin) {
            regionsPlugin.clearRegions();
          }
        }
      }

      fetchAudioFiles();

    } catch (error) {
      console.error('Error applying audio edit:', error.response ? error.response.data : error.message);
      alert(`Failed to apply edit: ${error.response ? error.response.data.message : error.message}`);

      // Clean up preview on error
      if (['fade_in', 'fade_out'].includes(operationType)) {
        removeFadeOverlay(activeAudioFile._id);
        setFadePreview({ type: null, duration: null, fileId: null });
      }
    }
  };

  const refreshActiveWaveform = useCallback(async (updatedFile) => {
    if (!updatedFile || !wavesurferInstances.current.has(updatedFile._id)) {
      return;
    }

    const ws = wavesurferInstances.current.get(updatedFile._id);

    // Clear any existing blob URL
    const oldBlobUrl = audioBlobUrls.current.get(updatedFile._id);
    if (oldBlobUrl) {
      URL.revokeObjectURL(oldBlobUrl);
      audioBlobUrls.current.delete(updatedFile._id);
    }

    // Fetch the updated audio data and reload the waveform
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`https://event-management-backend-z0ty.onrender.com/api/audio/files/${updatedFile._id}/stream`, {
        responseType: 'blob',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const blob = new Blob([response.data], { type: updatedFile.mimeType });
      const newBlobUrl = URL.createObjectURL(blob);
      audioBlobUrls.current.set(updatedFile._id, newBlobUrl);

      // Reload the waveform with new audio data
      ws.load(newBlobUrl);

      // Update the active file state
      setActiveAudioFile(updatedFile);

    } catch (error) {
      console.error('Error refreshing waveform:', error);
      // Fallback to reinitializing the waveform
      initializeWaveSurfer(updatedFile);
    }
  }, [initializeWaveSurfer]);

  // --- Region-based operations ---

  const handleAddRegion = () => {
    if (!activeAudioFile || !wavesurferInstances.current.has(activeAudioFile._id)) {
      alert("Please select an active audio file first.");
      return;
    }

    const ws = wavesurferInstances.current.get(activeAudioFile._id);
    const regionsPlugin = ws.plugins.find(plugin => plugin instanceof RegionsPlugin);

    if (regionsPlugin) {
      // Get current playback position or use 0 if not playing
      const currentTime = ws.getCurrentTime();
      const duration = ws.getDuration();

      // Create a region from current position (or start) for 2 seconds (or till end)
      const regionStart = currentTime;
      const regionEnd = Math.min(currentTime + 2, duration);

      const newRegion = regionsPlugin.addRegion({
        start: regionStart,
        end: regionEnd,
        color: 'rgba(255, 0, 0, 0.3)', // Semi-transparent red
        drag: true,
        resize: true,
      });

      // Immediately update the selected regions
      console.log('Region created with ID:', newRegion.id);
      setSelectedRegions(prev => {
        const newMap = new Map(prev);
        newMap.set(activeAudioFile._id, newRegion.id);
        console.log('Updated selectedRegions:', newMap);
        return newMap;
      });
    } else {
      console.error("RegionsPlugin not found");
    }
  };

  const getSelectedRegion = (fileId) => {
    const ws = wavesurferInstances.current.get(fileId);
    if (ws && selectedRegions.has(fileId)) {
      const regionsPlugin = ws.plugins.find(plugin => plugin instanceof RegionsPlugin);
      if (regionsPlugin) {
        return regionsPlugin.getRegions().find(region => region.id === selectedRegions.get(fileId));
      }
    }
    return null;
  };

  const handleCutRegion = async () => {
    const region = getSelectedRegion(activeAudioFile._id);
    if (!region) {
      alert("Please select a region to cut.");
      return;
    }
    await sendSingleEditToBackend('cut', {
      startTime: region.start,
      endTime: region.end,
    });
  };

  const handleCopyRegion = async () => {
    const region = getSelectedRegion(activeAudioFile._id);
    if (!region) {
      alert("Please select a region to copy.");
      return;
    }
    await sendSingleEditToBackend('copy', {
      startTime: region.start,
      endTime: region.end,
    });
  };

  const handlePasteRegion = async () => {
    if (!activeAudioFile) {
      alert("Please select an active audio file to paste into.");
      return;
    }
    const ws = wavesurferInstances.current.get(activeAudioFile._id);
    if (!ws) {
      alert("Waveform not ready for active file.");
      return;
    }
    // For paste, we typically paste at the current play position or a user-defined point.
    // Let's use the current play position as the insert position.
    const currentTime = ws.getCurrentTime();
    await sendSingleEditToBackend('paste', {
      pastePosition: currentTime, // Assuming paste position is where the playhead is
    });
  };

  // --- Handlers for Newly Added Operations ---

  const handleReverse = async () => {
    await sendSingleEditToBackend('reverse');
  };

  const handleSilence = async () => {
    const region = getSelectedRegion(activeAudioFile._id);
    if (!region) {
      alert("Please select a region to silence.");
      return;
    }
    await sendSingleEditToBackend('silence_region', {
      startTime: region.start,
      endTime: region.end,
    });
  };

  const handleTrim = async () => {
    const region = getSelectedRegion(activeAudioFile._id);
    if (!region) {
      alert("Please select a region to trim to.");
      return;
    }
    await sendSingleEditToBackend('trim', {
      startTime: region.start,
      endTime: region.end,
    });
  };

  const handleSplit = async () => {
    // For simplicity, let's assume a single split point from an input field or playhead
    // You'd typically get this from a UI element or the current playhead position
    // For this example, let's use the state variable `splitPosition`
    if (splitPosition <= 0 || splitPosition >= activeAudioFile.duration) {
      alert("Invalid split position. Must be between 0 and duration.");
      return;
    }
    await sendSingleEditToBackend('split', {
      splitPositions: [splitPosition], // Backend expects an array for split positions
    });
  };

  // Updated fade in handler with visual preview

  const handleFadeIn = async () => {
    if (!activeAudioFile) {
      alert("Please select an active audio file first.");
      return;
    }

    if (fadeDuration <= 0 || fadeDuration > activeAudioFile.duration) {
      alert("Invalid fade duration. Must be positive and less than or equal to file duration.");
      return;
    }

    // Show visual preview immediately
    addFadeOverlay(activeAudioFile._id, 'in', fadeDuration);
    setFadePreview({ type: 'in', duration: fadeDuration, fileId: activeAudioFile._id });

    // Apply the actual edit
    try {
      await sendSingleEditToBackend('fade_in', { fadeDuration });
    } catch (error) {
      // Remove preview if edit failed
      removeFadeOverlay(activeAudioFile._id);
      setFadePreview({ type: null, duration: null, fileId: null });
      throw error;
    }
  };


  const handleFadeOut = async () => {
    if (!activeAudioFile) {
      alert("Please select an active audio file first.");
      return;
    }

    if (fadeDuration <= 0 || fadeDuration > activeAudioFile.duration) {
      alert("Invalid fade duration. Must be positive and less than or equal to file duration.");
      return;
    }

    // Show visual preview immediately
    addFadeOverlay(activeAudioFile._id, 'out', fadeDuration);
    setFadePreview({ type: 'out', duration: fadeDuration, fileId: activeAudioFile._id });

    // Apply the actual edit
    try {
      await sendSingleEditToBackend('fade_out', { fadeDuration });
    } catch (error) {
      // Remove preview if edit failed
      removeFadeOverlay(activeAudioFile._id);
      setFadePreview({ type: null, duration: null, fileId: null });
      throw error;
    }
  };

  const handleInsert = async () => {
    if (!sourceAudioFileIdForInsert) {
      alert("Please select a source audio file to insert.");
      return;
    }
    if (insertPosition < 0 || insertPosition > activeAudioFile.duration) {
      alert("Invalid insert position. Must be within the active file's duration.");
      return;
    }

    const operationData = {
      insertPosition,
      sourceAudioFileId: sourceAudioFileIdForInsert,
    };

    // If sourceRegionForInsert has valid start/end times, add it
    if (sourceRegionForInsert.startTime !== undefined && sourceRegionForInsert.endTime !== undefined &&
      sourceRegionForInsert.startTime < sourceRegionForInsert.endTime) {
      operationData.sourceRegion = sourceRegionForInsert;
    }

    await sendSingleEditToBackend('insert', operationData);
  };

  const handleConcatenate = async () => {
    if (concatSourceFileIds.length === 0) {
      alert("Please select at least one source file to concatenate.");
      return;
    }
    await sendSingleEditToBackend('concatenate', {
      sourceAudioFileIds: concatSourceFileIds,
    });
  };

  const handleMerge = async () => {
    if (concatSourceFileIds.length === 0) {
      alert("Please select at least one source file to merge.");
      return;
    }
    await sendSingleEditToBackend('merge', {
      sourceAudioFileIds: concatSourceFileIds,
    });
  };

  const handleClearRegions = () => {
    if (!activeAudioFile || !wavesurferInstances.current.has(activeAudioFile._id)) {
      alert("Please select an active audio file first.");
      return;
    }

    const ws = wavesurferInstances.current.get(activeAudioFile._id);
    // const regionsPlugin = ws.plugins.find(plugin => plugin.constructor.name === 'RegionsPlugin');
    const regionsPlugin = ws.plugins.find(plugin => plugin instanceof RegionsPlugin);

    if (regionsPlugin) {
      regionsPlugin.clearRegions();
      setSelectedRegions(prev => {
        const newMap = new Map(prev);
        newMap.delete(activeAudioFile._id);
        return newMap;
      });
    }
  };

  // Add this CSS injection function
  const addFadeEffectsStyles = () => {
    if (!document.getElementById('fade-effects-styles')) {
      const style = document.createElement('style');
      style.id = 'fade-effects-styles';
      style.textContent = `
      .fade-overlay {
        position: absolute;
        top: 0;
        height: 100%;
        pointer-events: none;
        z-index: 10;
        transition: opacity 0.3s ease;
      }
      
      .fade-in-overlay {
        background: linear-gradient(to right, rgba(0, 255, 0, 0.4), rgba(0, 255, 0, 0));
        border-left: 2px solid #00ff00;
      }
      
      .fade-out-overlay {
        background: linear-gradient(to left, rgba(255, 0, 0, 0.4), rgba(255, 0, 0, 0));
        border-right: 2px solid #ff0000;
      }
      
      .waveform-instance-container {
        position: relative;
      }
      
      .fade-text {
        position: absolute;
        top: 5px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: bold;
        z-index: 15;
      }
      
      .editor-btn.processing {
        background-color: #ffa500;
        color: white;
        cursor: wait;
      }
    `;
      document.head.appendChild(style);
    }
  };

  // Function to add fade overlay to waveform
  const addFadeOverlay = useCallback((fileId, fadeType, fadeDuration) => {
    const ws = wavesurferInstances.current.get(fileId);
    if (!ws) return;

    // Remove existing fade overlay
    removeFadeOverlay(fileId);

    const waveformContainer = document.getElementById(`waveform-${fileId}`);
    if (!waveformContainer) return;

    const duration = ws.getDuration();
    if (duration === 0) return;

    const containerWidth = waveformContainer.offsetWidth;

    // Calculate overlay dimensions
    const fadeWidthPercent = Math.min((fadeDuration / duration) * 100, 100);

    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = `fade-overlay ${fadeType === 'in' ? 'fade-in-overlay' : 'fade-out-overlay'}`;
    overlay.id = `fade-overlay-${fileId}`;

    // Position and size the overlay
    if (fadeType === 'in') {
      overlay.style.left = '0';
      overlay.style.width = `${fadeWidthPercent}%`;
    } else {
      overlay.style.right = '0';
      overlay.style.width = `${fadeWidthPercent}%`;
    }

    // Add overlay to waveform container
    waveformContainer.style.position = 'relative';
    waveformContainer.appendChild(overlay);

    // Store reference for cleanup
    fadeOverlayRef.current.set(fileId, overlay);

    // Add fade duration text
    const fadeText = document.createElement('div');
    fadeText.className = 'fade-text';
    fadeText.textContent = `${fadeType.toUpperCase()} ${fadeDuration}s`;
    fadeText.style.cssText = `
    ${fadeType === 'in' ? 'left: 5px' : 'right: 5px'};
  `;
    overlay.appendChild(fadeText);
  }, []);

  // Function to remove fade overlay
  const removeFadeOverlay = useCallback((fileId) => {
    const existingOverlay = fadeOverlayRef.current.get(fileId);
    if (existingOverlay && existingOverlay.parentNode) {
      existingOverlay.parentNode.removeChild(existingOverlay);
      fadeOverlayRef.current.delete(fileId);
    }
  }, []);



  // --- Effects ---
  useEffect(() => {
    fetchAudioFiles();
  }, [fetchAudioFiles]);

  useEffect(() => {
    // Clean up wavesurfer instances when component unmounts
    return () => {
      wavesurferInstances.current.forEach(ws => ws.destroy());
      audioBlobUrls.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    // Cleanup volume timeout on unmount
    return () => {
      if (volumeTimeoutRef.current) {
        clearTimeout(volumeTimeoutRef.current);
      }
    };
  }, []);

  // Effect to manage active audio file waveform rendering
  useEffect(() => {
    if (activeAudioFile) {
      const ws = wavesurferInstances.current.get(activeAudioFile._id);
      if (!ws) {
        initializeWaveSurfer(activeAudioFile);
      } else {
        // Ensure the active waveform container is set if it was destroyed or moved
        // ws.setOptions({ container: `#waveform-${file._id}` });
        // ws.zoom(currentZoomLevel);
        ws.setOptions({ minPxPerSec: currentZoomLevel * 50 });
      }
    }
  }, [activeAudioFile, initializeWaveSurfer, currentZoomLevel]);

  // Effect for dropdown menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  // Effect to initialize WaveSurfer for newly added files
  useEffect(() => {
    selectedAudioFiles.forEach(file => {
      if (!wavesurferInstances.current.has(file._id)) {
        // Check if container exists before initializing
        const container = document.getElementById(`waveform-${file._id}`);
        if (container) {
          initializeWaveSurfer(file);
        }
      }
    });
  }, [selectedAudioFiles, initializeWaveSurfer]);

  // 4. Update the WaveSurfer volume effect to use playbackVolume
  useEffect(() => {
    if (activeAudioFile && wavesurferInstances.current.has(activeAudioFile._id)) {
      const ws = wavesurferInstances.current.get(activeAudioFile._id);
      if (ws) {
        // Use playbackVolume which is already clamped to 0-1
        ws.setVolume(playbackVolume);
      }
    }
  }, [playbackVolume, activeAudioFile]);

  // Add this useEffect to inject styles and handle cleanup
  useEffect(() => {
    // Add styles to head
    addFadeEffectsStyles();

    // Cleanup function
    return () => {
      // Clean up fade overlays
      fadeOverlayRef.current.forEach((overlay, fileId) => {
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      });
      fadeOverlayRef.current.clear();
    };
  }, []);

  // Update your existing cleanup useEffect to include fade overlay cleanup
  useEffect(() => {
    return () => {
      // Clean up fade overlays
      fadeOverlayRef.current.forEach((overlay, fileId) => {
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      });
      fadeOverlayRef.current.clear();

      // Your existing cleanup code
      wavesurferInstances.current.forEach(ws => ws.destroy());
      audioBlobUrls.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  return (
    <div className="audio-editor-container">
      <h5 style={{ textAlign: 'center' }}>Audio Editor</h5>

      {/* Debug info - remove this later */}
      <div style={{ background: '#f0f0f0', padding: '10px', margin: '10px 0' }}>
        <strong>Debug Info:</strong><br />
        Active File: {activeAudioFile?.originalName || 'None'}<br />
        Selected Regions: {JSON.stringify(Array.from(selectedRegions.entries()))}<br />
        Has Selected Region: {activeAudioFile && selectedRegions.has(activeAudioFile._id) ? 'Yes' : 'No'}
      </div>


      <div className="controls-section">
        {/* File Management */}
        <div className="control-group control">
          {/* <label>File Management:</label> */}
          <button className="editor-btn" onClick={handleUploadClick}>
            <Upload className="icon" /> Upload Audio
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept="audio/*"
            style={{ display: 'none' }}
          />
          <button className="editor-btn" onClick={handleDownloadActiveFile} disabled={!activeAudioFile}>
            <Download className="icon" /> Download Active
          </button>
          <button className="editor-btn delete-btn" onClick={handleDeleteActiveFile} disabled={!activeAudioFile}>
            <Trash2 className="icon" /> Delete Active
          </button>

          {/* Dropdown for audio files */}
          <div className={`file-dropdown-container ${showDropdown ? 'show' : ''}`} ref={dropdownRef}>
            <button
              className="editor-btn dropdown-toggle"
              onClick={() => {
                console.log("Dropdown button clicked!");
                setShowDropdown(!showDropdown);
                console.log("showDropdown state after click (intended):", !showDropdown);
              }}
            >
              Select Files to Edit <ChevronDown className="icon" />
            </button>

            {showDropdown && (
              <div className="dropdown-menu">
                {/* ... dropdown content ... */}
                {Array.isArray(audioFiles) && audioFiles.length === 0 ? (
                  <p>No audio files uploaded yet.</p>
                ) : (
                  Array.isArray(audioFiles) &&
                  audioFiles.map((file) => (
                    <div key={file._id} className="dropdown-item">
                      <span>{file.originalName}</span>
                      <button
                        className="editor-btn small-btn"
                        onClick={() => handleSelectAudioFile(file)}
                        disabled={selectedAudioFiles.some(f => f._id === file._id)}
                      >
                        Add to Editor
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Playback controls */}
          <button className="editor-btn" onClick={handlePlayPause} disabled={!activeAudioFile}>
            <Play className="icon" /> / <Pause className="icon" />
          </button>
          <button className="editor-btn" onClick={handleStop} disabled={!activeAudioFile}>
            <Rewind className="icon" /> Stop
          </button>

          {/* Add these two new buttons here */}
          <button className="editor-btn" onClick={handleSeekBackward} disabled={!activeAudioFile}>
            <SkipBack className="icon" /> -5s
          </button>
          <button className="editor-btn" onClick={handleSeekForward} disabled={!activeAudioFile}>
            <SkipForward className="icon" /> +5s
          </button>

          {/* Zoom Controls */}
          <button className="editor-btn" onClick={() => handleZoom(1.1)} disabled={!activeAudioFile}>
            <ZoomIn className="icon" /> Zoom In
          </button>
          <button className="editor-btn" onClick={() => handleZoom(0.9)} disabled={!activeAudioFile}>
            <ZoomOut className="icon" /> Zoom Out
          </button>


          {/* Volume Controls */}
          {/* // Updated volume control UI */}
          <div className="input-group">
            <label style={{ fontSize: '10px', color: 'black' }} htmlFor="volume-control">
              Volume (Processing):
            </label>
            <input
              type="range"
              id="volume-control"
              min="0"
              max="2"  // Keep the 200% range for backend processing
              step="0.1"
              value={processingVolume}
              onChange={(e) => {
                const newVolume = parseFloat(e.target.value);
                setProcessingVolume(newVolume);

                // Set playback volume (clamped to 0-1 for HTML audio)
                const clampedPlaybackVolume = Math.min(newVolume, 1);
                setPlaybackVolume(clampedPlaybackVolume);

                // Auto-apply to backend after delay
                handleVolumeChangeWithAutoApply(newVolume);
              }}
              style={{ width: '100px' }}
            />
            <span style={{
              fontSize: '10px',
              color: processingVolume > 1 ? 'red' : 'black',
              fontWeight: processingVolume > 1 ? 'bold' : 'normal'
            }}>
              {Math.round(processingVolume * 100)}%
              {processingVolume > 1 && ' (Amplified)'}
            </span>
          </div>
          <button
            className="editor-btn"
            onClick={() => {
              if (processingVolume === 0) {
                setProcessingVolume(1);
                setPlaybackVolume(1);
              } else {
                setProcessingVolume(0);
                setPlaybackVolume(0);
              }
            }}
            disabled={!activeAudioFile}
          >
            {processingVolume === 0 ? <Volume2 className="icon" /> : <VolumeX className="icon" />}
            {processingVolume === 0 ? 'Unmute' : 'Mute'}
          </button>

          {/* Edit Operations (Core) */}

          <button className="editor-btn" onClick={handleCutRegion} disabled={!activeAudioFile || !selectedRegions.has(activeAudioFile?._id)}>
            <Scissors className="icon" /> Cut Region
          </button>
          <button className="editor-btn" onClick={handleCopyRegion} disabled={!activeAudioFile || !selectedRegions.has(activeAudioFile?._id)}>
            <Copy className="icon" /> Copy Region
          </button>
          <button className="editor-btn" onClick={handlePasteRegion} disabled={!activeAudioFile}>
            <ClipboardPaste className="icon" /> Paste
          </button>
          <button className="editor-btn" onClick={handleTrim} disabled={!activeAudioFile || !selectedRegions.has(activeAudioFile?._id)}>
            <Crop className="icon" /> Trim to Region
          </button>
          <button className="editor-btn" onClick={handleSilence} disabled={!activeAudioFile || !selectedRegions.has(activeAudioFile?._id)}>
            <VolumeX className="icon" /> Silence Region
          </button>

          <button className="editor-btn" onClick={handleAddRegion} disabled={!activeAudioFile}>
            <SquarePlus className="icon" /> Add Region
          </button>



        </div>









        {/* Newly Integrated Operations */}
        <div className="control-group">
          <h6 style={{
            justifyContent: 'center', alignItems: 'center', paddingTop: '10px'
          }}>Advanced Edits:</h6>
          <button className="editor-btn" onClick={handleReverse} disabled={!activeAudioFile}>
            <RotateCcw className="icon" /> Reverse
          </button>

     

          <button
            className={`editor-btn ${fadePreview.type === 'in' && fadePreview.fileId === activeAudioFile?._id ? 'processing' : ''}`}
            onClick={handleFadeIn}
            disabled={!activeAudioFile || (fadePreview.type === 'in' && fadePreview.fileId === activeAudioFile?._id)}
          >
            <SignalLow className="icon" />
            {fadePreview.type === 'in' && fadePreview.fileId === activeAudioFile?._id ? 'Applying...' : 'Fade In'}
          </button>
          <button
            className={`editor-btn ${fadePreview.type === 'out' && fadePreview.fileId === activeAudioFile?._id ? 'processing' : ''}`}
            onClick={handleFadeOut}
            disabled={!activeAudioFile || (fadePreview.type === 'out' && fadePreview.fileId === activeAudioFile?._id)}
          >
            <Signal className="icon" />
            {fadePreview.type === 'out' && fadePreview.fileId === activeAudioFile?._id ? 'Applying...' : 'Fade Out'}
          </button>
          <div className="input-group">
            <label style={{
              fontSize: '10px', color: 'black',
            }} htmlFor="fade-duration">Fade Duration (s):</label>
            <input
              type="number"
              id="fade-duration"
              value={fadeDuration}
              onChange={(e) => setFadeDuration(parseFloat(e.target.value))}
              min="0.1"
              step="0.1"
              style={{ width: '80px', height: '20px' }}
            />
          </div>

        </div>

        <div className="control-group">
          <div className="input-group">
            <label style={{ fontSize: '10px', color: 'black' }} htmlFor="split-position">Split at (s):</label>
            <input
              type="number"
              id="split-position"
              value={splitPosition}
              onChange={(e) => setSplitPosition(parseFloat(e.target.value))}
              min="0"
              step="0.1"
              style={{ width: '80px', height: '20px' }}
              disabled={!activeAudioFile}
            />
          </div>
          <button className="editor-btn" onClick={handleSplit} disabled={!activeAudioFile || splitPosition <= 0 || splitPosition >= activeAudioFile?.duration}>
            <Split className="icon" /> Split File
          </button>
        </div>

        <div className="control-group">
          <label style={{ fontSize: '10px', color: 'black', paddingTop: '20px' }}>Insert Audio:</label>
          <div className="input-group">
            <label style={{ fontSize: '10px', color: 'black' }} htmlFor="insert-position">Insert Pos (s):</label>
            <input
              type="number"
              id="insert-position"
              value={insertPosition}
              onChange={(e) => setInsertPosition(parseFloat(e.target.value))}
              min="0"
              step="0.1"
              style={{ width: '80px', height: '20px' }}
              disabled={!activeAudioFile}
            />
          </div>
          <div className="input-group">
            <label style={{ fontSize: '10px', color: 'black' }} htmlFor="source-file-insert">Source File:</label>
            <select
              id="source-file-insert"
              value={sourceAudioFileIdForInsert}
              onChange={(e) => setSourceAudioFileIdForInsert(e.target.value)}
              disabled={!activeAudioFile}
              style={{ height: 'auto', padding: "2px", fontSize: '10px', height: '25px' }}
            >
              <option value="" >Select a file</option>
              {Array.isArray(audioFiles) && audioFiles.map(file => ( // <= ADD HERE
                file._id !== activeAudioFile?._id && (
                  <option key={file._id} value={file._id}>{file.originalName}</option>
                )
              ))}
            </select>
          </div>
          {/* Optional: Source Region for Insert */}
          <div className="input-group">
            <label style={{ fontSize: '10px', color: 'black' }}>Source Region (s):</label>
            <input
              type="number"
              placeholder="Start"
              value={sourceRegionForInsert.startTime}
              onChange={(e) => setSourceRegionForInsert(prev => ({ ...prev, startTime: parseFloat(e.target.value) }))}
              min="0"
              step="0.1"
              // style={{ width: '60px' }}
              disabled={!sourceAudioFileIdForInsert}
              style={{ width: '80px', height: '20px' }}

            />
            <input
              type="number"
              placeholder="End"
              value={sourceRegionForInsert.endTime}
              onChange={(e) => setSourceRegionForInsert(prev => ({ ...prev, endTime: parseFloat(e.target.value) }))}
              min="0"
              step="0.1"
              // style={{ width: '60px' }}
              style={{ width: '80px', height: '20px' }}
              disabled={!sourceAudioFileIdForInsert}
            />
          </div>

          <button className="editor-btn" onClick={handleInsert} disabled={!activeAudioFile || !sourceAudioFileIdForInsert}>
            <PlusCircle className="icon" /> Insert Audio
          </button>

        </div>

        <div className="control-group">
          <label style={{ fontSize: '10px', color: 'black', paddingTop: '20px' }}>Concatenate/Merge</label>
          <div className="input-group">
            <label style={{ fontSize: '10px', color: 'black', paddingTop: '20px' }} htmlFor="concat-source-files">Files to add:</label>
            <select
              id="concat-source-files"
              multiple
              value={concatSourceFileIds}
              onChange={(e) => setConcatSourceFileIds(Array.from(e.target.selectedOptions, option => option.value))}
              disabled={!activeAudioFile}
              style={{ minHeight: '80px' }}
            >
              {Array.isArray(audioFiles) && audioFiles.map(file => ( // <= ADD HERE
                file._id !== activeAudioFile?._id && (
                  <option key={file._id} value={file._id}>{file.originalName}</option>
                )
              ))}
            </select>
          </div>
          <button className="editor-btn" onClick={handleConcatenate} disabled={!activeAudioFile || concatSourceFileIds.length === 0}>
            <Combine className="icon" /> Concatenate
          </button>

          <button className="editor-btn" onClick={handleMerge} disabled={!activeAudioFile || concatSourceFileIds.length === 0}>
            <Combine className="icon" /> Merge
          </button>

        </div>

      </div>




      {/* Display selected audio files and their waveforms */}
      {selectedAudioFiles.length > 0 && (
        <div className="all-waveforms-container">
          <h2>All Selected Audio Files:</h2>
          {Array.isArray(selectedAudioFiles) && selectedAudioFiles.map((file) => ( // <= ADD HERE (good practice)
            <div
              key={file._id}
              className={`waveform-display-item ${activeAudioFile && activeAudioFile._id === file._id ? 'active' : ''}`}
            >
              <h3>
                {file.originalName}
                {activeAudioFile && activeAudioFile._id === file._id && " (Active)"}
              </h3>
              <div className="file-info">
                <span className="duration-info">
                  Duration: {file.duration ? `${file.duration.toFixed(2)}s` : 'Loading...'}
                </span>
              </div>
              <div id={`waveform-${file._id}`} className="waveform-instance-container"></div>
              <div id={`waveform-timeline-${file._id}`} className="waveform-timeline-instance-container"></div>
              <button className="editor-btn small-btn" onClick={() => handleSetAndManageActiveAudioFile(file)}>
                Set Active
              </button>
              <button
                className="editor-btn small-btn delete-waveform-btn"
                onClick={() => handleRemoveSelectedWaveform(file._id)}
                title="Remove from editor (frontend only)"
              >
                <X className="icon" /> Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AudioEditor;


