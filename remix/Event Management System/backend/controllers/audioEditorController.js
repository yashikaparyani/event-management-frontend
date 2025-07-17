const AudioFile = require('../models/AudioFile');
const AudioEditOperation = require('../models/AudioEditOperation');
const AudioRegion = require('../models/AudioRegion');
const AudioClipboard = require('../models/AudioClipboard'); // Assuming you'll use this for copy/paste
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { promisify } = require('util');
const mongoose = require('mongoose');
const crypto = require('crypto'); // For generating unique temp filenames

if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}
if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
}

const execPromise = promisify(require('child_process').exec);

async function getAudioMetadata(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      else {
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        if (!audioStream) {
          reject(new Error('No audio stream found in file'));
        }
        resolve({
          duration: audioStream.duration,
          fileSize: metadata.format.size,
          mimeType: metadata.format.tags.major_brand ? `audio/${metadata.format.tags.major_brand}` : 'audio/mpeg', // Best guess or derive from format
          format: metadata.format.format_name.split(',')[0],
          sampleRate: audioStream.sample_rate,
          bitRate: audioStream.bit_rate,
          channels: audioStream.channels
        });
      }
    });
  });
}

const audioController = {

  // ========== FILE MANAGEMENT OPERATIONS (EXISTING) ==========
  uploadAudioFiles: async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No audio files uploaded'
        });
      }

      const userId = req.user._id;
      const uploadedFiles = [];
      const failedFiles = [];

      for (const file of req.files) {
        try {
          const metadata = await new Promise((resolve, reject) => {
            ffmpeg.ffprobe(file.path, (err, metadata) => {
              if (err) reject(err);
              else resolve(metadata);
            });
          });

          const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
          if (!audioStream) {
            throw new Error('No audio stream found in file');
          }

          const duration = audioStream.duration;
          const format = metadata.format.format_name.split(',')[0];
          const mimeType = file.mimetype;
          const sampleRate = audioStream.sample_rate;
          const bitRate = audioStream.bit_rate;
          const channels = audioStream.channels;

          const newAudioFile = new AudioFile({
            userId,
            originalName: file.originalname,
            fileName: file.filename,
            filePath: file.path,
            fileSize: file.size,
            duration,
            mimeType,
            format,
            sampleRate,
            bitRate,
            channels,
            isOriginal: true,
            processingStatus: 'completed'
          });

          await newAudioFile.save();
          uploadedFiles.push({
            id: newAudioFile._id,
            originalName: newAudioFile.originalName,
            fileName: newAudioFile.fileName,
            duration: newAudioFile.duration,
            fileUrl: newAudioFile.fileUrl // Virtual field
          });
        } catch (error) {
          console.error(`Failed to process file ${file.originalname}:`, error);
          failedFiles.push({
            originalName: file.originalname,
            error: error.message
          });
          // Clean up partially uploaded file
          try {
            await fs.unlink(file.path);
          } catch (unlinkError) {
            console.error(`Error deleting failed upload file ${file.path}:`, unlinkError);
          }
        }
      }

      res.status(200).json({
        success: true,
        message: 'Audio files uploaded and processed',
        uploadedFiles,
        failedFiles
      });

    } catch (error) {
      console.error('Error during audio upload:', error);
      res.status(500).json({
        success: false,
        message: 'Error uploading audio files',
        error: error.message
      });
    }
  },

  getAudioFiles: async (req, res) => {
    try {
      const userId = req.user._id;
      const audioFiles = await AudioFile.find({ userId })
        .select('-filePath -editHistory -__v') // Exclude sensitive fields
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        data: audioFiles
      });
    } catch (error) {
      console.error('Error fetching audio files:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching audio files',
        error: error.message
      });
    }
  },

  getAudioFileById: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const audioFile = await AudioFile.findOne({ _id: id, userId })
        .select('-filePath -__v'); // Exclude sensitive fields

      if (!audioFile) {
        return res.status(404).json({
          success: false,
          message: 'Audio file not found or you do not have permission to access it.'
        });
      }

      res.status(200).json({
        success: true,
        data: audioFile
      });
    } catch (error) {
      console.error('Error fetching audio file by ID:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching audio file',
        error: error.message
      });
    }
  },

  streamAudioFile: async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    try {
      const audioFile = await AudioFile.findOne({ _id: id, userId });
      if (!audioFile) {
        return res.status(404).json({ message: 'Audio file not found.' });
      }

      const filePath = audioFile.filePath;

      // Check if file exists on disk
      try {
        await fs.access(filePath, fs.constants.F_OK);
      } catch (e) {
        console.error(`File not found on disk: ${filePath}`);
        return res.status(404).json({ message: 'Audio file not found on server.' });
      }

      const stat = await fs.stat(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fsSync.createReadStream(filePath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': audioFile.mimeType,
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': audioFile.mimeType,
        };
        res.writeHead(200, head);
        fsSync.createReadStream(filePath).pipe(res);
      }
    } catch (error) {
      console.error('Error streaming audio file:', error);
      res.status(500).json({ message: 'Error streaming audio file.' });
    }
  },

  deleteAudioFile: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const audioFile = await AudioFile.findOne({ _id: id, userId });

      if (!audioFile) {
        return res.status(404).json({ success: false, message: 'Audio file not found.' });
      }

      // Delete file from disk
      try {
        await fs.unlink(audioFile.filePath);
      } catch (error) {
        console.error(`Error deleting file from disk (${audioFile.filePath}):`, error);
        // Continue even if file delete fails, to remove from DB
      }

      // Delete associated regions
      await AudioRegion.deleteMany({ audioFileId: id });

      // Delete associated edit operations where this was the target
      await AudioEditOperation.deleteMany({ targetAudioFileId: id });
      await AudioEditOperation.deleteMany({ resultAudioFileId: id });


      // Delete from database
      await AudioFile.deleteOne({ _id: id });

      res.status(200).json({ success: true, message: 'Audio file and associated data deleted successfully.' });

    } catch (error) {
      console.error('Error deleting audio file:', error);
      res.status(500).json({ success: false, message: 'Error deleting audio file.', error: error.message });
    }
  },

  downloadAudioFile: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const audioFile = await AudioFile.findOne({ _id: id, userId });

      if (!audioFile) {
        return res.status(404).json({ success: false, message: 'Audio file not found or you do not have permission.' });
      }

      res.download(audioFile.filePath, audioFile.originalName, (err) => {
        if (err) {
          console.error('Error downloading audio file:', err);
          res.status(500).json({ success: false, message: 'Error downloading audio file.' });
        }
      });
    } catch (error) {
      console.error('Error in downloadAudioFile:', error);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },

  // applySingleEdit: async (req, res) => {
  //   let tempFilesToClean = [];
  //   try {
  //     const { operationType, targetAudioFileId, operationData } = req.body;
  //     const userId = req.user.id;

  //     // Fetch the target audio file
  //     const targetAudioFile = await AudioFile.findById(targetAudioFileId);
  //     if (!targetAudioFile) {
  //       return res.status(404).json({ success: false, message: 'Target audio file not found.' });
  //     }

  //     const currentInputFilePath = targetAudioFile.filePath;
  //     let currentDuration = targetAudioFile.duration;

  //     const tempOutputFileName = `${crypto.randomBytes(16).toString('hex')}_temp_output.wav`;
  //     const tempOutputFilePath = path.join(__dirname, '..', 'uploads', 'audio', tempOutputFileName);



  //     let ffmpegCommand;
  //     let newDuration = currentDuration;

  //     // Create temporary input file
  //     const tempInputFileName = `${crypto.randomBytes(16).toString('hex')}_temp_input.wav`;
  //     const tempInputFilePath = path.join(__dirname, '..', 'uploads', 'audio', tempInputFileName);
  //     await fs.copyFile(currentInputFilePath, tempInputFilePath);

  //     tempFilesToClean = [tempInputFilePath, tempOutputFilePath];

  //     switch (operationType) {
  //       case 'cut': {
  //         const { startTime, endTime } = operationData;
  //         if (startTime === undefined || endTime === undefined || startTime < 0 || endTime > currentDuration || startTime >= endTime) {
  //           return res.status(400).json({ success: false, message: 'Invalid cut parameters.', error: 'Invalid cut parameters' });
  //         }

  //         const part1Path = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(8).toString('hex')}_part1.wav`);
  //         const part2Path = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(8).toString('hex')}_part2.wav`);
  //         tempFilesToClean.push(part1Path, part2Path);

  //         // Extract part 1
  //         await new Promise((resolve, reject) => {
  //           ffmpeg(tempInputFilePath)
  //             .setStartTime(0)
  //             .setDuration(startTime)
  //             .output(part1Path)
  //             .on('end', () => { console.log('Part 1 extracted'); resolve(); })
  //             .on('error', (err) => { console.error('Error extracting part 1:', err); reject(err); })
  //             .run();
  //         });

  //         // Extract part 2
  //         await new Promise((resolve, reject) => {
  //           ffmpeg(tempInputFilePath)
  //             .setStartTime(endTime)
  //             .output(part2Path)
  //             .on('end', () => { console.log('Part 2 extracted'); resolve(); })
  //             .on('error', (err) => { console.error('Error extracting part 2:', err); reject(err); })
  //             .run();
  //         });

  //         // Concatenate parts to temp output
  //         ffmpegCommand = `ffmpeg -y -i "concat:${part1Path}|${part2Path}" -c copy "${tempOutputFilePath}"`;
  //         newDuration = currentDuration - (endTime - startTime);
  //         break;
  //       }

  //       case 'trim': {
  //         const { startTime, endTime } = operationData;
  //         if (startTime === undefined || endTime === undefined || startTime < 0 || endTime > currentDuration || startTime >= endTime) {
  //           return res.status(400).json({ success: false, message: 'Invalid trim parameters.', error: 'Invalid trim parameters' });
  //         }
  //         ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -ss ${startTime} -to ${endTime} -c copy "${tempOutputFilePath}"`;
  //         newDuration = endTime - startTime;
  //         break;
  //       }

  //       case 'volume_adjust': {
  //         const { volumeLevel } = operationData;
  //         if (volumeLevel === undefined || volumeLevel < 0) {
  //           return res.status(400).json({ success: false, message: 'Invalid volume level.', error: 'Invalid volume level' });
  //         }
  //         ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter:a "volume=${volumeLevel}" "${tempOutputFilePath}"`;
  //         break;
  //       }

  //       case 'fade_in': {
  //         const { fadeDuration } = operationData;
  //         const durationToUse = currentDuration; // Use the actual duration of the input file
  //         if (fadeDuration === undefined || fadeDuration <= 0 || fadeDuration > durationToUse) {
  //           return res.status(400).json({ success: false, message: 'Invalid fade_in parameters. Fade duration must be positive and not exceed audio duration.', error: 'Invalid fade_in parameters' });
  //         }
  //         // The 'afade' filter starts at 'st' and ends after 'd' duration.
  //         // For fade-in, st=0 is common.
  //         ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter_complex "afade=t=in:st=0:d=${fadeDuration}" "${tempOutputFilePath}"`;
  //         break;
  //       }

  //       case 'fade_out': {
  //         const { fadeDuration } = operationData;
  //         const durationToUse = currentDuration; // Use the actual duration of the input file
  //         if (fadeDuration === undefined || fadeDuration <= 0 || fadeDuration > durationToUse) {
  //           return res.status(400).json({ success: false, message: 'Invalid fade_out parameters. Fade duration must be positive and not exceed audio duration.', error: 'Invalid fade_out parameters' });
  //         }
  //         // For fade-out, 'st' should be (total_duration - fade_duration)
  //         const fadeStartTime = Math.max(0, durationToUse - fadeDuration);
  //         ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter_complex "afade=t=out:st=${fadeStartTime}:d=${fadeDuration}" "${tempOutputFilePath}"`;
  //         break;
  //       }

  //       case 'reverse': {
  //         ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter_complex "areverse" "${tempOutputFilePath}"`;
  //         break;
  //       }

  //       case 'silence_region': {
  //         const { startTime, endTime } = operationData;
  //         if (startTime === undefined || endTime === undefined || startTime < 0 || endTime > currentDuration || startTime >= endTime) {
  //           return res.status(400).json({ success: false, message: 'Invalid silence region parameters.', error: 'Invalid silence region parameters' });
  //         }

  //         // Apply silence to the specified region using volume filter with enable option
  //         // This maintains the original timeline and only silences the specified time range
  //         ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -af "volume=enable='between(t,${startTime},${endTime})':volume=0" "${tempOutputFilePath}"`;

  //         // Alternative approach 1 - Using filter_complex:
  //         // ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter_complex "[0:a]volume=0:enable='between(t,${startTime},${endTime})'[out]" -map "[out]" "${tempOutputFilePath}"`;

  //         // Alternative approach 2 - If you need precise control, use the original concat method but fix the logic:
  //         // const durationBeforeSilence = startTime;
  //         // const durationOfSilence = endTime - startTime;
  //         // const durationAfterSilence = currentDuration - endTime;
  //         // 
  //         // if (durationBeforeSilence > 0 && durationAfterSilence > 0) {
  //         //   // All three segments exist
  //         //   ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter_complex "[0:a]atrim=start=0:duration=${durationBeforeSilence},asetpts=PTS-STARTPTS[a1]; anullsrc=d=${durationOfSilence}:r=44100:cl=stereo[a2]; [0:a]atrim=start=${endTime},asetpts=PTS-STARTPTS[a3]; [a1][a2][a3]concat=n=3:v=0:a=1[out]" -map "[out]" "${tempOutputFilePath}"`;
  //         // } else if (durationBeforeSilence > 0) {
  //         //   // Only before and silence segments
  //         //   ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter_complex "[0:a]atrim=start=0:duration=${durationBeforeSilence},asetpts=PTS-STARTPTS[a1]; anullsrc=d=${durationOfSilence}:r=44100:cl=stereo[a2]; [a1][a2]concat=n=2:v=0:a=1[out]" -map "[out]" "${tempOutputFilePath}"`;
  //         // } else if (durationAfterSilence > 0) {
  //         //   // Only silence and after segments
  //         //   ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter_complex "anullsrc=d=${durationOfSilence}:r=44100:cl=stereo[a1]; [0:a]atrim=start=${endTime},asetpts=PTS-STARTPTS[a2]; [a1][a2]concat=n=2:v=0:a=1[out]" -map "[out]" "${tempOutputFilePath}"`;
  //         // } else {
  //         //   // Only silence segment (entire audio)
  //         //   ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter_complex "anullsrc=d=${durationOfSilence}:r=44100:cl=stereo[out]" -map "[out]" "${tempOutputFilePath}"`;
  //         // }

  //         newDuration = currentDuration; // Duration remains the same
  //         break;
  //       }

  //       case 'concatenate': {
  //         const { sourceAudioFileIds } = operationData;

  //         if (!sourceAudioFileIds || !Array.isArray(sourceAudioFileIds) || sourceAudioFileIds.length === 0) {
  //           return res.status(400).json({
  //             success: false,
  //             message: 'Invalid concatenate parameters. At least one source file ID is required.',
  //             error: 'Invalid concatenate parameters'
  //           });
  //         }

  //         // Fetch all source audio files
  //         const sourceAudioFiles = await AudioFile.find({
  //           _id: { $in: sourceAudioFileIds },
  //           userId: userId
  //         });

  //         if (sourceAudioFiles.length !== sourceAudioFileIds.length) {
  //           return res.status(404).json({
  //             success: false,
  //             message: 'One or more source audio files not found or access denied.',
  //             error: 'Source files not found'
  //           });
  //         }

  //         // ✅ FIX: Keep original format, don't convert to WAV
  //         const originalExt = path.extname(currentInputFilePath);
  //         const tempOutputFileNameFixed = `${crypto.randomBytes(16).toString('hex')}_temp_output${originalExt}`;
  //         const tempOutputFilePathFixed = path.join(__dirname, '..', 'uploads', 'audio', tempOutputFileNameFixed);

  //         // Add to cleanup list
  //         tempFilesToClean.push(tempOutputFilePathFixed);

  //         // Create temporary copies of source files in ORIGINAL format
  //         const tempSourceFiles = [];
  //         for (let i = 0; i < sourceAudioFiles.length; i++) {
  //           const sourceFile = sourceAudioFiles[i];
  //           const sourceExt = path.extname(sourceFile.filePath);
  //           const tempSourceFileName = `${crypto.randomBytes(8).toString('hex')}_source_${i}${sourceExt}`;
  //           const tempSourceFilePath = path.join(__dirname, '..', 'uploads', 'audio', tempSourceFileName);

  //           const sourceFullPath = path.join(__dirname, '..', sourceFile.filePath);
  //           await fs.copyFile(sourceFullPath, tempSourceFilePath);

  //           tempSourceFiles.push(tempSourceFilePath);
  //           tempFilesToClean.push(tempSourceFilePath);
  //         }

  //         // ✅ FIX: Create temp input in original format
  //         const inputExt = path.extname(currentInputFilePath);
  //         const tempInputFileNameFixed = `${crypto.randomBytes(16).toString('hex')}_temp_input${inputExt}`;
  //         const tempInputFilePathFixed = path.join(__dirname, '..', 'uploads', 'audio', tempInputFileNameFixed);
  //         await fs.copyFile(currentInputFilePath, tempInputFilePathFixed);

  //         // Add to cleanup list
  //         tempFilesToClean.push(tempInputFilePathFixed);

  //         // Create file list for FFmpeg concat demuxer
  //         const concatListFileName = `${crypto.randomBytes(8).toString('hex')}_concat_list.txt`;
  //         const concatListFilePath = path.join(__dirname, '..', 'uploads', 'audio', concatListFileName);
  //         tempFilesToClean.push(concatListFilePath);

  //         // Build the concat list content with original format files
  //         let concatListContent = `file '${path.basename(tempInputFilePathFixed)}'\n`;
  //         tempSourceFiles.forEach(tempSourceFile => {
  //           concatListContent += `file '${path.basename(tempSourceFile)}'\n`;
  //         });

  //         await fs.writeFile(concatListFilePath, concatListContent);

  //         // ✅ MAIN FIX: Proper FFmpeg command with format consistency
  //         const concatDir = path.join(__dirname, '..', 'uploads', 'audio');

  //         if (originalExt.toLowerCase() === '.mp3') {
  //           // For MP3 files: re-encode to ensure compatibility
  //           ffmpegCommand = `cd "${concatDir}" && ffmpeg -y -f concat -safe 0 -i "${path.basename(concatListFilePath)}" -c:a libmp3lame -b:a 192k "${path.basename(tempOutputFileNameFixed)}"`;
  //         } else {
  //           // For other formats: try copy first, fallback to re-encode
  //           ffmpegCommand = `cd "${concatDir}" && ffmpeg -y -f concat -safe 0 -i "${path.basename(concatListFilePath)}" -c copy "${path.basename(tempOutputFileNameFixed)}"`;
  //         }

  //         // Store the output path for later use in file replacement
  //         global.tempOutputFilePathFixed = tempOutputFilePathFixed;

  //         // Calculate new duration
  //         newDuration = currentDuration;
  //         sourceAudioFiles.forEach(sourceFile => {
  //           newDuration += sourceFile.duration;
  //         });

  //         console.log(`Concatenating ${sourceAudioFiles.length} files to target. New duration: ${newDuration}s`);
  //         console.log(`FFmpeg command: ${ffmpegCommand}`);
  //         break;
  //       }
  //       // The order of concatenation will be: Target File + Source File 1 + Source File 2 + ... + Source File N

  //       case 'insert': {
  //         const { insertPosition, sourceAudioFileId, sourceRegionStartTime, sourceRegionEndTime } = operationData;
  //         if (insertPosition === undefined || insertPosition < 0 || insertPosition > currentDuration) {
  //           return res.status(400).json({ success: false, message: 'Invalid insert position.', error: 'Invalid insert position' });
  //         }
  //         if (sourceAudioFileId === undefined || sourceRegionStartTime === undefined || sourceRegionEndTime === undefined || sourceRegionStartTime < 0 || sourceRegionEndTime <= sourceRegionStartTime) {
  //           return res.status(400).json({ success: false, message: 'Invalid source region parameters for insert operation.', error: 'Invalid source region parameters' });
  //         }

  //         const sourceAudioFile = await AudioFile.findById(sourceAudioFileId);
  //         if (!sourceAudioFile) {
  //           return res.status(404).json({ success: false, message: 'Source audio file for insertion not found.', error: 'Source audio file not found' });
  //         }
  //         const fullSourceFilePath = sourceAudioFile.filePath;

  //         const clipPath = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(16).toString('hex')}_clip.wav`);
  //         tempFilesToClean.push(clipPath);

  //         // Extract the clip from the source audio file
  //         await new Promise((resolve, reject) => {
  //           ffmpeg(fullSourceFilePath)
  //             .setStartTime(sourceRegionStartTime)
  //             .setDuration(sourceRegionEndTime - sourceRegionStartTime)
  //             .output(clipPath)
  //             .on('end', () => { console.log('Clip extracted for insertion'); resolve(); })
  //             .on('error', (err) => { console.error('Error extracting clip for insertion:', err); reject(err); })
  //             .run();
  //         });

  //         // Split the target audio file into two parts at the insert position
  //         const part1Path = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(16).toString('hex')}_insert_part1.wav`);
  //         const part2Path = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(16).toString('hex')}_insert_part2.wav`);
  //         tempFilesToClean.push(part1Path, part2Path);

  //         await new Promise((resolve, reject) => {
  //           ffmpeg(tempInputFilePath)
  //             .setStartTime(0)
  //             .setDuration(insertPosition)
  //             .output(part1Path)
  //             .on('end', () => { console.log('Insert Part 1 extracted'); resolve(); })
  //             .on('error', (err) => { console.error('Error extracting insert part 1:', err); reject(err); })
  //             .run();
  //         });

  //         await new Promise((resolve, reject) => {
  //           ffmpeg(tempInputFilePath)
  //             .setStartTime(insertPosition)
  //             .output(part2Path)
  //             .on('end', () => { console.log('Insert Part 2 extracted'); resolve(); })
  //             .on('error', (err) => { console.error('Error extracting insert part 2:', err); reject(err); })
  //             .run();
  //         });

  //         // Concatenate part1, the extracted clip, and part2
  //         ffmpegCommand = `ffmpeg -y -i "concat:${part1Path}|${clipPath}|${part2Path}" -c copy "${tempOutputFilePath}"`;
  //         newDuration = currentDuration + (sourceRegionEndTime - sourceRegionStartTime);
  //         break;
  //       }

  //       case 'copy_paste': {
  //         const { insertPosition, sourceAudioFileId, sourceRegionStartTime, sourceRegionEndTime } = operationData;
  //         if (insertPosition === undefined || insertPosition < 0 || insertPosition > currentDuration) {
  //           return res.status(400).json({ success: false, message: 'Invalid paste position.', error: 'Invalid paste position' });
  //         }
  //         if (sourceAudioFileId === undefined || sourceRegionStartTime === undefined || sourceRegionEndTime === undefined || sourceRegionStartTime < 0 || sourceRegionEndTime <= sourceRegionStartTime) {
  //           return res.status(400).json({ success: false, message: 'Invalid source region parameters for paste operation.', error: 'Invalid source region parameters' });
  //         }

  //         const sourceAudioFile = await AudioFile.findById(sourceAudioFileId);
  //         if (!sourceAudioFile) {
  //           return res.status(404).json({ success: false, message: 'Source audio file for paste not found.', error: 'Source audio file not found' });
  //         }
  //         const fullSourceFilePath = sourceAudioFile.filePath;

  //         const clipPath = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(16).toString('hex')}_paste_clip.wav`);
  //         tempFilesToClean.push(clipPath);

  //         // Extract the clip from the source audio file
  //         await new Promise((resolve, reject) => {
  //           ffmpeg(fullSourceFilePath)
  //             .setStartTime(sourceRegionStartTime)
  //             .setDuration(sourceRegionEndTime - sourceRegionStartTime)
  //             .output(clipPath)
  //             .on('end', () => { console.log('Clip extracted for paste'); resolve(); })
  //             .on('error', (err) => { console.error('Error extracting clip for paste:', err); reject(err); })
  //             .run();
  //         });

  //         // Split the target audio file into two parts at the paste position
  //         const part1Path = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(16).toString('hex')}_paste_part1.wav`);
  //         const part2Path = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(16).toString('hex')}_paste_part2.wav`);
  //         tempFilesToClean.push(part1Path, part2Path);

  //         await new Promise((resolve, reject) => {
  //           ffmpeg(tempInputFilePath)
  //             .setStartTime(0)
  //             .setDuration(insertPosition)
  //             .output(part1Path)
  //             .on('end', () => { console.log('Paste Part 1 extracted'); resolve(); })
  //             .on('error', (err) => { console.error('Error extracting paste part 1:', err); reject(err); })
  //             .run();
  //         });

  //         await new Promise((resolve, reject) => {
  //           ffmpeg(tempInputFilePath)
  //             .setStartTime(insertPosition)
  //             .output(part2Path)
  //             .on('end', () => { console.log('Paste Part 2 extracted'); resolve(); })
  //             .on('error', (err) => { console.error('Error extracting paste part 2:', err); reject(err); })
  //             .run();
  //         });

  //         // Concatenate part1, the extracted clip, and part2
  //         ffmpegCommand = `ffmpeg -y -i "concat:${part1Path}|${clipPath}|${part2Path}" -c copy "${tempOutputFilePath}"`;
  //         newDuration = currentDuration + (sourceRegionEndTime - sourceRegionStartTime);
  //         break;
  //       }

  //       case 'delete_region': {
  //         const { startTime, endTime } = operationData;
  //         if (startTime === undefined || endTime === undefined || startTime < 0 || endTime > currentDuration || startTime >= endTime) {
  //           return res.status(400).json({ success: false, message: 'Invalid delete region parameters.', error: 'Invalid delete region parameters' });
  //         }

  //         const part1Path = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(16).toString('hex')}_delete_part1.wav`);
  //         const part2Path = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(16).toString('hex')}_delete_part2.wav`);
  //         tempFilesToClean.push(part1Path, part2Path);

  //         // Extract part before the region to be deleted
  //         await new Promise((resolve, reject) => {
  //           ffmpeg(tempInputFilePath)
  //             .setStartTime(0)
  //             .setDuration(startTime)
  //             .output(part1Path)
  //             .on('end', () => { console.log('Delete Part 1 extracted'); resolve(); })
  //             .on('error', (err) => { console.error('Error extracting delete part 1:', err); reject(err); })
  //             .run();
  //         });

  //         // Extract part after the region to be deleted
  //         await new Promise((resolve, reject) => {
  //           ffmpeg(tempInputFilePath)
  //             .setStartTime(endTime)
  //             .output(part2Path)
  //             .on('end', () => { console.log('Delete Part 2 extracted'); resolve(); })
  //             .on('error', (err) => { console.error('Error extracting delete part 2:', err); reject(err); })
  //             .run();
  //         });

  //         // Concatenate part1 and part2
  //         ffmpegCommand = `ffmpeg -y -i "concat:${part1Path}|${part2Path}" -c copy "${tempOutputFilePath}"`;
  //         newDuration = currentDuration - (endTime - startTime);
  //         break;
  //       }

  //       case 'split': {
  //         const { splitPosition } = operationData;
  //         if (splitPosition === undefined || splitPosition <= 0 || splitPosition >= currentDuration) {
  //           return res.status(400).json({ success: false, message: 'Invalid split position.', error: 'Invalid split position' });
  //         }

  //         const newFile1Name = `${crypto.randomBytes(16).toString('hex')}_part1.wav`;
  //         const newFile2Name = `${crypto.randomBytes(16).toString('hex')}_part2.wav`;
  //         const newFile1Path = path.join(__dirname, '..', 'uploads', 'audio', newFile1Name);
  //         const newFile2Path = path.join(__dirname, '..', 'uploads', 'audio', newFile2Name);

  //         // Create part 1
  //         await new Promise((resolve, reject) => {
  //           ffmpeg(tempInputFilePath)
  //             .setStartTime(0)
  //             .setDuration(splitPosition)
  //             .output(newFile1Path)
  //             .on('end', () => { console.log('Split Part 1 created'); resolve(); })
  //             .on('error', (err) => { console.error('Error creating split part 1:', err); reject(err); })
  //             .run();
  //         });

  //         // Create part 2
  //         await new Promise((resolve, reject) => {
  //           ffmpeg(tempInputFilePath)
  //             .setStartTime(splitPosition)
  //             .output(newFile2Path)
  //             .on('end', () => { console.log('Split Part 2 created'); resolve(); })
  //             .on('error', (err) => { console.error('Error creating split part 2:', err); reject(err); })
  //             .run();
  //         });

  //         // Save both new files to DB
  //         const duration1 = splitPosition;
  //         const duration2 = currentDuration - splitPosition;

  //         const originalNameWithoutExt = path.basename(targetAudioFile.originalName, path.extname(targetAudioFile.originalName));

  //         const newAudioFile1 = new AudioFile({
  //           userId: userId,
  //           originalName: `${originalNameWithoutExt}_part1`,
  //           fileName: newFile1Name,
  //           filePath: path.relative(path.join(__dirname, '..'), newFile1Path),
  //           fileSize: fsSync.statSync(newFile1Path).size,
  //           duration: duration1,
  //           mimeType: 'audio/wav', // Or detect from output
  //           format: 'wav',
  //           isOriginal: false,
  //           parentFileId: targetAudioFileId,
  //           processingStatus: 'completed',
  //           editHistory: [{
  //             operation: 'split_part1',
  //             parameters: { originalDuration: targetAudioFile.duration, splitPosition },
  //             timestamp: new Date()
  //           }]
  //         });
  //         await newAudioFile1.save();

  //         const newAudioFile2 = new AudioFile({
  //           userId: userId,
  //           originalName: `${originalNameWithoutExt}_part2`,
  //           fileName: newFile2Name,
  //           filePath: path.relative(path.join(__dirname, '..'), newFile2Path),
  //           fileSize: fsSync.statSync(newFile2Path).size,
  //           duration: duration2,
  //           mimeType: 'audio/wav',
  //           format: 'wav',
  //           isOriginal: false,
  //           parentFileId: targetAudioFileId,
  //           processingStatus: 'completed',
  //           editHistory: [{
  //             operation: 'split_part2',
  //             parameters: { originalDuration: targetAudioFile.duration, splitPosition },
  //             timestamp: new Date()
  //           }]
  //         });
  //         await newAudioFile2.save();

  //         // No single output file for split, return both new files
  //         return res.status(201).json({
  //           success: true,
  //           message: 'Audio file split successfully into two new files.',
  //           data: {
  //             newAudioFile: [
  //               { id: newAudioFile1._id, originalName: newAudioFile1.originalName, fileName: newAudioFile1.fileName, duration: newAudioFile1.duration, fileUrl: newAudioFile1.fileUrl },
  //               { id: newAudioFile2._id, originalName: newAudioFile2.originalName, fileName: newAudioFile2.fileName, duration: newAudioFile2.duration, fileUrl: newAudioFile2.fileUrl }
  //             ]
  //           }
  //         });
  //       }

  //       default:
  //         for (const tempFile of tempFilesToClean) {
  //           try {
  //             await fs.unlink(tempFile);
  //           } catch (cleanUpError) {
  //             console.warn(`Could not delete temporary file ${tempFile}:`, cleanUpError);
  //           }
  //         }
  //         return res.status(400).json({ success: false, message: `Unsupported operation type: ${operationType}` });
  //     }

  //     // Execute the FFmpeg command
  //     if (ffmpegCommand) {
  //       await execPromise(ffmpegCommand);
  //       console.log(`FFmpeg command executed for ${operationType}`);
  //     } else {
  //       throw new Error('FFmpeg command not generated.');
  //     }

  //     // ✅ KEY CHANGE: Replace original file with processed file
  //     const fullOriginalFilePath = path.join(__dirname, '..', currentInputFilePath);

  //     // Create backup of original (optional safety measure)
  //     const backupPath = `${fullOriginalFilePath}.backup`;
  //     await fs.copyFile(fullOriginalFilePath, backupPath);

  //     try {
  //       // Replace original file with processed result
  //       // ✅ Use tempOutputFilePathFixed for concatenate, tempOutputFilePath for other operations
  //       const outputPath = operationType === 'concatenate' ? global.tempOutputFilePathFixed : tempOutputFilePath;
  //       await fs.copyFile(outputPath, fullOriginalFilePath);

  //       // Get new file metadata
  //       const newMetadata = await getAudioMetadata(fullOriginalFilePath);

  //       // ✅ KEY CHANGE: Update existing AudioFile record instead of creating new one
  //       targetAudioFile.duration = newMetadata.duration;
  //       targetAudioFile.fileSize = newMetadata.fileSize;
  //       targetAudioFile.sampleRate = newMetadata.sampleRate;
  //       targetAudioFile.bitRate = newMetadata.bitRate;
  //       targetAudioFile.channels = newMetadata.channels;
  //       targetAudioFile.updatedAt = new Date();

  //       // Add to edit history (optional)
  //       if (!targetAudioFile.editHistory) {
  //         targetAudioFile.editHistory = [];
  //       }
  //       targetAudioFile.editHistory.push({
  //         operation: operationType,
  //         parameters: operationData,
  //         timestamp: new Date(),
  //         previousDuration: currentDuration
  //       });

  //       await targetAudioFile.save();

  //       // Remove backup file if everything succeeded
  //       await fs.unlink(backupPath);

  //       // Clean up global variable
  //       if (global.tempOutputFilePathFixed) {
  //         delete global.tempOutputFilePathFixed;
  //       }

  //     } catch (replaceError) {
  //       // If replacement failed, restore from backup
  //       await fs.copyFile(backupPath, fullOriginalFilePath);
  //       await fs.unlink(backupPath);

  //       // Clean up global variable
  //       if (global.tempOutputFilePathFixed) {
  //         delete global.tempOutputFilePathFixed;
  //       }

  //       throw replaceError;
  //     }

  //     // Clean up temporary files
  //     for (const tempFile of tempFilesToClean) {
  //       try {
  //         await fs.unlink(tempFile);
  //       } catch (cleanUpError) {
  //         console.warn(`Could not delete temporary file ${tempFile}:`, cleanUpError);
  //       }
  //     }

  //     // ✅ KEY CHANGE: Return the updated same file instead of new file
  //     res.status(200).json({
  //       success: true,
  //       message: 'Audio edit applied successfully.',
  //       data: {
  //         audioFile: {
  //           id: targetAudioFile._id,
  //           originalName: targetAudioFile.originalName,
  //           fileName: targetAudioFile.fileName,
  //           duration: targetAudioFile.duration,
  //           fileUrl: targetAudioFile.fileUrl
  //         }
  //       }
  //     });

  //   } catch (error) {
  //     console.error('Error applying single audio edit:', error);
  //     // Clean up temp files on error
  //     if (tempFilesToClean && tempFilesToClean.length > 0) {
  //       for (const tempFile of tempFilesToClean) {
  //         try {
  //           await fs.unlink(tempFile);
  //         } catch (cleanUpError) {
  //           console.warn(`Could not delete temporary file during error cleanup ${tempFile}:`, cleanUpError);
  //         }
  //       }
  //     }
  //     res.status(500).json({
  //       success: false,
  //       message: `Failed to apply ${req.body.operationType} operation: ${error.message || error.toString() || 'An unknown error occurred'}`,
  //       error: error.message || error.toString() || 'An unknown error occurred'
  //     });
  //   }
  // },


    applySingleEdit: async (req, res) => {
    let tempFilesToClean = [];
    
    try {
      const { operationType, targetAudioFileId, operationData } = req.body;
      const userId = req.user.id;

      // Fetch the target audio file
      const targetAudioFile = await AudioFile.findById(targetAudioFileId);
      if (!targetAudioFile) {
        return res.status(404).json({ success: false, message: 'Target audio file not found.' });
      }

      const currentInputFilePath = targetAudioFile.filePath;
      let currentDuration = targetAudioFile.duration;

      const tempOutputFileName = `${crypto.randomBytes(16).toString('hex')}_temp_output.wav`;
      const tempOutputFilePath = path.join(__dirname, '..', 'uploads', 'audio', tempOutputFileName);



      let ffmpegCommand;
      let newDuration = currentDuration;

      // Create temporary input file
      const tempInputFileName = `${crypto.randomBytes(16).toString('hex')}_temp_input.wav`;
      const tempInputFilePath = path.join(__dirname, '..', 'uploads', 'audio', tempInputFileName);
      await fs.copyFile(currentInputFilePath, tempInputFilePath);

      tempFilesToClean = [tempInputFilePath, tempOutputFilePath];

      switch (operationType) {
        case 'cut': {
          const { startTime, endTime } = operationData;
          if (startTime === undefined || endTime === undefined || startTime < 0 || endTime > currentDuration || startTime >= endTime) {
            return res.status(400).json({ success: false, message: 'Invalid cut parameters.', error: 'Invalid cut parameters' });
          }

          const part1Path = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(8).toString('hex')}_part1.wav`);
          const part2Path = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(8).toString('hex')}_part2.wav`);
          tempFilesToClean.push(part1Path, part2Path);

          // Extract part 1
          await new Promise((resolve, reject) => {
            ffmpeg(tempInputFilePath)
              .setStartTime(0)
              .setDuration(startTime)
              .output(part1Path)
              .on('end', () => { console.log('Part 1 extracted'); resolve(); })
              .on('error', (err) => { console.error('Error extracting part 1:', err); reject(err); })
              .run();
          });

          // Extract part 2
          await new Promise((resolve, reject) => {
            ffmpeg(tempInputFilePath)
              .setStartTime(endTime)
              .output(part2Path)
              .on('end', () => { console.log('Part 2 extracted'); resolve(); })
              .on('error', (err) => { console.error('Error extracting part 2:', err); reject(err); })
              .run();
          });

          // Concatenate parts to temp output
          ffmpegCommand = `ffmpeg -y -i "concat:${part1Path}|${part2Path}" -c copy "${tempOutputFilePath}"`;
          newDuration = currentDuration - (endTime - startTime);
          break;
        }

        case 'trim': {
          const { startTime, endTime } = operationData;
          if (startTime === undefined || endTime === undefined || startTime < 0 || endTime > currentDuration || startTime >= endTime) {
            return res.status(400).json({ success: false, message: 'Invalid trim parameters.', error: 'Invalid trim parameters' });
          }
          ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -ss ${startTime} -to ${endTime} -c copy "${tempOutputFilePath}"`;
          newDuration = endTime - startTime;
          break;
        }

        case 'volume_adjust': {
          const { volumeLevel } = operationData;
          if (volumeLevel === undefined || volumeLevel < 0) {
            return res.status(400).json({ success: false, message: 'Invalid volume level.', error: 'Invalid volume level' });
          }
          ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter:a "volume=${volumeLevel}" "${tempOutputFilePath}"`;
          break;
        }

        case 'fade_in': {
          const { fadeDuration } = operationData;
          const durationToUse = currentDuration; // Use the actual duration of the input file
          if (fadeDuration === undefined || fadeDuration <= 0 || fadeDuration > durationToUse) {
            return res.status(400).json({ success: false, message: 'Invalid fade_in parameters. Fade duration must be positive and not exceed audio duration.', error: 'Invalid fade_in parameters' });
          }
          // The 'afade' filter starts at 'st' and ends after 'd' duration.
          // For fade-in, st=0 is common.
          ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter_complex "afade=t=in:st=0:d=${fadeDuration}" "${tempOutputFilePath}"`;
          break;
        }

        case 'fade_out': {
          const { fadeDuration } = operationData;
          const durationToUse = currentDuration; // Use the actual duration of the input file
          if (fadeDuration === undefined || fadeDuration <= 0 || fadeDuration > durationToUse) {
            return res.status(400).json({ success: false, message: 'Invalid fade_out parameters. Fade duration must be positive and not exceed audio duration.', error: 'Invalid fade_out parameters' });
          }
          // For fade-out, 'st' should be (total_duration - fade_duration)
          const fadeStartTime = Math.max(0, durationToUse - fadeDuration);
          ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter_complex "afade=t=out:st=${fadeStartTime}:d=${fadeDuration}" "${tempOutputFilePath}"`;
          break;
        }

        case 'reverse': {
          ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter_complex "areverse" "${tempOutputFilePath}"`;
          break;
        }

        case 'silence_region': {
          const { startTime, endTime } = operationData;
          if (startTime === undefined || endTime === undefined || startTime < 0 || endTime > currentDuration || startTime >= endTime) {
            return res.status(400).json({ success: false, message: 'Invalid silence region parameters.', error: 'Invalid silence region parameters' });
          }

          // Apply silence to the specified region using volume filter with enable option
          // This maintains the original timeline and only silences the specified time range
          ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -af "volume=enable='between(t,${startTime},${endTime})':volume=0" "${tempOutputFilePath}"`;

          // Alternative approach 1 - Using filter_complex:
          // ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter_complex "[0:a]volume=0:enable='between(t,${startTime},${endTime})'[out]" -map "[out]" "${tempOutputFilePath}"`;

          // Alternative approach 2 - If you need precise control, use the original concat method but fix the logic:
          // const durationBeforeSilence = startTime;
          // const durationOfSilence = endTime - startTime;
          // const durationAfterSilence = currentDuration - endTime;
          // 
          // if (durationBeforeSilence > 0 && durationAfterSilence > 0) {
          //   // All three segments exist
          //   ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter_complex "[0:a]atrim=start=0:duration=${durationBeforeSilence},asetpts=PTS-STARTPTS[a1]; anullsrc=d=${durationOfSilence}:r=44100:cl=stereo[a2]; [0:a]atrim=start=${endTime},asetpts=PTS-STARTPTS[a3]; [a1][a2][a3]concat=n=3:v=0:a=1[out]" -map "[out]" "${tempOutputFilePath}"`;
          // } else if (durationBeforeSilence > 0) {
          //   // Only before and silence segments
          //   ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter_complex "[0:a]atrim=start=0:duration=${durationBeforeSilence},asetpts=PTS-STARTPTS[a1]; anullsrc=d=${durationOfSilence}:r=44100:cl=stereo[a2]; [a1][a2]concat=n=2:v=0:a=1[out]" -map "[out]" "${tempOutputFilePath}"`;
          // } else if (durationAfterSilence > 0) {
          //   // Only silence and after segments
          //   ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter_complex "anullsrc=d=${durationOfSilence}:r=44100:cl=stereo[a1]; [0:a]atrim=start=${endTime},asetpts=PTS-STARTPTS[a2]; [a1][a2]concat=n=2:v=0:a=1[out]" -map "[out]" "${tempOutputFilePath}"`;
          // } else {
          //   // Only silence segment (entire audio)
          //   ffmpegCommand = `ffmpeg -y -i "${tempInputFilePath}" -filter_complex "anullsrc=d=${durationOfSilence}:r=44100:cl=stereo[out]" -map "[out]" "${tempOutputFilePath}"`;
          // }

          newDuration = currentDuration; // Duration remains the same
          break;
        }

        case 'concatenate': {
          const { sourceAudioFileIds } = operationData;

          if (!sourceAudioFileIds || !Array.isArray(sourceAudioFileIds) || sourceAudioFileIds.length === 0) {
            return res.status(400).json({
              success: false,
              message: 'Invalid concatenate parameters. At least one source file ID is required.',
              error: 'Invalid concatenate parameters'
            });
          }

          // Fetch all source audio files
          const sourceAudioFiles = await AudioFile.find({
            _id: { $in: sourceAudioFileIds },
            userId: userId
          });

          if (sourceAudioFiles.length !== sourceAudioFileIds.length) {
            return res.status(404).json({
              success: false,
              message: 'One or more source audio files not found or access denied.',
              error: 'Source files not found'
            });
          }

          // ✅ FIX: Keep original format, don't convert to WAV
          const originalExt = path.extname(currentInputFilePath);
          const tempOutputFileNameFixed = `${crypto.randomBytes(16).toString('hex')}_temp_output${originalExt}`;
          const tempOutputFilePathFixed = path.join(__dirname, '..', 'uploads', 'audio', tempOutputFileNameFixed);

          // Add to cleanup list
          tempFilesToClean.push(tempOutputFilePathFixed);

          // Create temporary copies of source files in ORIGINAL format
          const tempSourceFiles = [];
          for (let i = 0; i < sourceAudioFiles.length; i++) {
            const sourceFile = sourceAudioFiles[i];
            const sourceExt = path.extname(sourceFile.filePath);
            const tempSourceFileName = `${crypto.randomBytes(8).toString('hex')}_source_${i}${sourceExt}`;
            const tempSourceFilePath = path.join(__dirname, '..', 'uploads', 'audio', tempSourceFileName);

            const sourceFullPath = path.join(__dirname, '..', sourceFile.filePath);
            await fs.copyFile(sourceFullPath, tempSourceFilePath);

            tempSourceFiles.push(tempSourceFilePath);
            tempFilesToClean.push(tempSourceFilePath);
          }

          // ✅ FIX: Create temp input in original format
          const inputExt = path.extname(currentInputFilePath);
          const tempInputFileNameFixed = `${crypto.randomBytes(16).toString('hex')}_temp_input${inputExt}`;
          const tempInputFilePathFixed = path.join(__dirname, '..', 'uploads', 'audio', tempInputFileNameFixed);
          await fs.copyFile(currentInputFilePath, tempInputFilePathFixed);

          // Add to cleanup list
          tempFilesToClean.push(tempInputFilePathFixed);

          // Create file list for FFmpeg concat demuxer
          const concatListFileName = `${crypto.randomBytes(8).toString('hex')}_concat_list.txt`;
          const concatListFilePath = path.join(__dirname, '..', 'uploads', 'audio', concatListFileName);
          tempFilesToClean.push(concatListFilePath);

          // Build the concat list content with original format files
          let concatListContent = `file '${path.basename(tempInputFilePathFixed)}'\n`;
          tempSourceFiles.forEach(tempSourceFile => {
            concatListContent += `file '${path.basename(tempSourceFile)}'\n`;
          });

          await fs.writeFile(concatListFilePath, concatListContent);

          // ✅ MAIN FIX: Proper FFmpeg command with format consistency
          const concatDir = path.join(__dirname, '..', 'uploads', 'audio');

          if (originalExt.toLowerCase() === '.mp3') {
            // For MP3 files: re-encode to ensure compatibility
            ffmpegCommand = `cd "${concatDir}" && ffmpeg -y -f concat -safe 0 -i "${path.basename(concatListFilePath)}" -c:a libmp3lame -b:a 192k "${path.basename(tempOutputFileNameFixed)}"`;
          } else {
            // For other formats: try copy first, fallback to re-encode
            ffmpegCommand = `cd "${concatDir}" && ffmpeg -y -f concat -safe 0 -i "${path.basename(concatListFilePath)}" -c copy "${path.basename(tempOutputFileNameFixed)}"`;
          }

          // Store the output path for later use in file replacement
          global.tempOutputFilePathFixed = tempOutputFilePathFixed;

          // Calculate new duration
          newDuration = currentDuration;
          sourceAudioFiles.forEach(sourceFile => {
            newDuration += sourceFile.duration;
          });

          console.log(`Concatenating ${sourceAudioFiles.length} files to target. New duration: ${newDuration}s`);
          console.log(`FFmpeg command: ${ffmpegCommand}`);
          break;
        }
        // The order of concatenation will be: Target File + Source File 1 + Source File 2 + ... + Source File N

        case 'insert': {
          const { insertPosition, sourceAudioFileId, sourceRegionStartTime, sourceRegionEndTime } = operationData;
          if (insertPosition === undefined || insertPosition < 0 || insertPosition > currentDuration) {
            return res.status(400).json({ success: false, message: 'Invalid insert position.', error: 'Invalid insert position' });
          }
          if (sourceAudioFileId === undefined || sourceRegionStartTime === undefined || sourceRegionEndTime === undefined || sourceRegionStartTime < 0 || sourceRegionEndTime <= sourceRegionStartTime) {
            return res.status(400).json({ success: false, message: 'Invalid source region parameters for insert operation.', error: 'Invalid source region parameters' });
          }

          const sourceAudioFile = await AudioFile.findById(sourceAudioFileId);
          if (!sourceAudioFile) {
            return res.status(404).json({ success: false, message: 'Source audio file for insertion not found.', error: 'Source audio file not found' });
          }
          const fullSourceFilePath = sourceAudioFile.filePath;

          const clipPath = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(16).toString('hex')}_clip.wav`);
          tempFilesToClean.push(clipPath);

          // Extract the clip from the source audio file
          await new Promise((resolve, reject) => {
            ffmpeg(fullSourceFilePath)
              .setStartTime(sourceRegionStartTime)
              .setDuration(sourceRegionEndTime - sourceRegionStartTime)
              .output(clipPath)
              .on('end', () => { console.log('Clip extracted for insertion'); resolve(); })
              .on('error', (err) => { console.error('Error extracting clip for insertion:', err); reject(err); })
              .run();
          });

          // Split the target audio file into two parts at the insert position
          const part1Path = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(16).toString('hex')}_insert_part1.wav`);
          const part2Path = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(16).toString('hex')}_insert_part2.wav`);
          tempFilesToClean.push(part1Path, part2Path);

          await new Promise((resolve, reject) => {
            ffmpeg(tempInputFilePath)
              .setStartTime(0)
              .setDuration(insertPosition)
              .output(part1Path)
              .on('end', () => { console.log('Insert Part 1 extracted'); resolve(); })
              .on('error', (err) => { console.error('Error extracting insert part 1:', err); reject(err); })
              .run();
          });

          await new Promise((resolve, reject) => {
            ffmpeg(tempInputFilePath)
              .setStartTime(insertPosition)
              .output(part2Path)
              .on('end', () => { console.log('Insert Part 2 extracted'); resolve(); })
              .on('error', (err) => { console.error('Error extracting insert part 2:', err); reject(err); })
              .run();
          });

          // Concatenate part1, the extracted clip, and part2
          ffmpegCommand = `ffmpeg -y -i "concat:${part1Path}|${clipPath}|${part2Path}" -c copy "${tempOutputFilePath}"`;
          newDuration = currentDuration + (sourceRegionEndTime - sourceRegionStartTime);
          break;
        }

        case 'copy_paste': {
          const { insertPosition, sourceAudioFileId, sourceRegionStartTime, sourceRegionEndTime } = operationData;
          if (insertPosition === undefined || insertPosition < 0 || insertPosition > currentDuration) {
            return res.status(400).json({ success: false, message: 'Invalid paste position.', error: 'Invalid paste position' });
          }
          if (sourceAudioFileId === undefined || sourceRegionStartTime === undefined || sourceRegionEndTime === undefined || sourceRegionStartTime < 0 || sourceRegionEndTime <= sourceRegionStartTime) {
            return res.status(400).json({ success: false, message: 'Invalid source region parameters for paste operation.', error: 'Invalid source region parameters' });
          }

          const sourceAudioFile = await AudioFile.findById(sourceAudioFileId);
          if (!sourceAudioFile) {
            return res.status(404).json({ success: false, message: 'Source audio file for paste not found.', error: 'Source audio file not found' });
          }
          const fullSourceFilePath = sourceAudioFile.filePath;

          const clipPath = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(16).toString('hex')}_paste_clip.wav`);
          tempFilesToClean.push(clipPath);

          // Extract the clip from the source audio file
          await new Promise((resolve, reject) => {
            ffmpeg(fullSourceFilePath)
              .setStartTime(sourceRegionStartTime)
              .setDuration(sourceRegionEndTime - sourceRegionStartTime)
              .output(clipPath)
              .on('end', () => { console.log('Clip extracted for paste'); resolve(); })
              .on('error', (err) => { console.error('Error extracting clip for paste:', err); reject(err); })
              .run();
          });

          // Split the target audio file into two parts at the paste position
          const part1Path = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(16).toString('hex')}_paste_part1.wav`);
          const part2Path = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(16).toString('hex')}_paste_part2.wav`);
          tempFilesToClean.push(part1Path, part2Path);

          await new Promise((resolve, reject) => {
            ffmpeg(tempInputFilePath)
              .setStartTime(0)
              .setDuration(insertPosition)
              .output(part1Path)
              .on('end', () => { console.log('Paste Part 1 extracted'); resolve(); })
              .on('error', (err) => { console.error('Error extracting paste part 1:', err); reject(err); })
              .run();
          });

          await new Promise((resolve, reject) => {
            ffmpeg(tempInputFilePath)
              .setStartTime(insertPosition)
              .output(part2Path)
              .on('end', () => { console.log('Paste Part 2 extracted'); resolve(); })
              .on('error', (err) => { console.error('Error extracting paste part 2:', err); reject(err); })
              .run();
          });

          // Concatenate part1, the extracted clip, and part2
          ffmpegCommand = `ffmpeg -y -i "concat:${part1Path}|${clipPath}|${part2Path}" -c copy "${tempOutputFilePath}"`;
          newDuration = currentDuration + (sourceRegionEndTime - sourceRegionStartTime);
          break;
        }

        case 'delete_region': {
          const { startTime, endTime } = operationData;
          if (startTime === undefined || endTime === undefined || startTime < 0 || endTime > currentDuration || startTime >= endTime) {
            return res.status(400).json({ success: false, message: 'Invalid delete region parameters.', error: 'Invalid delete region parameters' });
          }

          const part1Path = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(16).toString('hex')}_delete_part1.wav`);
          const part2Path = path.join(__dirname, '..', 'uploads', 'audio', `${crypto.randomBytes(16).toString('hex')}_delete_part2.wav`);
          tempFilesToClean.push(part1Path, part2Path);

          // Extract part before the region to be deleted
          await new Promise((resolve, reject) => {
            ffmpeg(tempInputFilePath)
              .setStartTime(0)
              .setDuration(startTime)
              .output(part1Path)
              .on('end', () => { console.log('Delete Part 1 extracted'); resolve(); })
              .on('error', (err) => { console.error('Error extracting delete part 1:', err); reject(err); })
              .run();
          });

          // Extract part after the region to be deleted
          await new Promise((resolve, reject) => {
            ffmpeg(tempInputFilePath)
              .setStartTime(endTime)
              .output(part2Path)
              .on('end', () => { console.log('Delete Part 2 extracted'); resolve(); })
              .on('error', (err) => { console.error('Error extracting delete part 2:', err); reject(err); })
              .run();
          });

          // Concatenate part1 and part2
          ffmpegCommand = `ffmpeg -y -i "concat:${part1Path}|${part2Path}" -c copy "${tempOutputFilePath}"`;
          newDuration = currentDuration - (endTime - startTime);
          break;
        }

        case 'split': {
          const { splitPosition } = operationData;
          if (splitPosition === undefined || splitPosition <= 0 || splitPosition >= currentDuration) {
            return res.status(400).json({ success: false, message: 'Invalid split position.', error: 'Invalid split position' });
          }

          const newFile1Name = `${crypto.randomBytes(16).toString('hex')}_part1.wav`;
          const newFile2Name = `${crypto.randomBytes(16).toString('hex')}_part2.wav`;
          const newFile1Path = path.join(__dirname, '..', 'uploads', 'audio', newFile1Name);
          const newFile2Path = path.join(__dirname, '..', 'uploads', 'audio', newFile2Name);

          // Create part 1
          await new Promise((resolve, reject) => {
            ffmpeg(tempInputFilePath)
              .setStartTime(0)
              .setDuration(splitPosition)
              .output(newFile1Path)
              .on('end', () => { console.log('Split Part 1 created'); resolve(); })
              .on('error', (err) => { console.error('Error creating split part 1:', err); reject(err); })
              .run();
          });

          // Create part 2
          await new Promise((resolve, reject) => {
            ffmpeg(tempInputFilePath)
              .setStartTime(splitPosition)
              .output(newFile2Path)
              .on('end', () => { console.log('Split Part 2 created'); resolve(); })
              .on('error', (err) => { console.error('Error creating split part 2:', err); reject(err); })
              .run();
          });

          // Save both new files to DB
          const duration1 = splitPosition;
          const duration2 = currentDuration - splitPosition;

          const originalNameWithoutExt = path.basename(targetAudioFile.originalName, path.extname(targetAudioFile.originalName));

          const newAudioFile1 = new AudioFile({
            userId: userId,
            originalName: `${originalNameWithoutExt}_part1`,
            fileName: newFile1Name,
            filePath: path.relative(path.join(__dirname, '..'), newFile1Path),
            fileSize: fsSync.statSync(newFile1Path).size,
            duration: duration1,
            mimeType: 'audio/wav', // Or detect from output
            format: 'wav',
            isOriginal: false,
            parentFileId: targetAudioFileId,
            processingStatus: 'completed',
            editHistory: [{
              operation: 'split_part1',
              parameters: { originalDuration: targetAudioFile.duration, splitPosition },
              timestamp: new Date()
            }]
          });
          await newAudioFile1.save();

          const newAudioFile2 = new AudioFile({
            userId: userId,
            originalName: `${originalNameWithoutExt}_part2`,
            fileName: newFile2Name,
            filePath: path.relative(path.join(__dirname, '..'), newFile2Path),
            fileSize: fsSync.statSync(newFile2Path).size,
            duration: duration2,
            mimeType: 'audio/wav',
            format: 'wav',
            isOriginal: false,
            parentFileId: targetAudioFileId,
            processingStatus: 'completed',
            editHistory: [{
              operation: 'split_part2',
              parameters: { originalDuration: targetAudioFile.duration, splitPosition },
              timestamp: new Date()
            }]
          });
          await newAudioFile2.save();

          // No single output file for split, return both new files
          return res.status(201).json({
            success: true,
            message: 'Audio file split successfully into two new files.',
            data: {
              newAudioFile: [
                { id: newAudioFile1._id, originalName: newAudioFile1.originalName, fileName: newAudioFile1.fileName, duration: newAudioFile1.duration, fileUrl: newAudioFile1.fileUrl },
                { id: newAudioFile2._id, originalName: newAudioFile2.originalName, fileName: newAudioFile2.fileName, duration: newAudioFile2.duration, fileUrl: newAudioFile2.fileUrl }
              ]
            }
          });
        }

        default:
          for (const tempFile of tempFilesToClean) {
            try {
              await fs.unlink(tempFile);
            } catch (cleanUpError) {
              console.warn(`Could not delete temporary file ${tempFile}:`, cleanUpError);
            }
          }
          return res.status(400).json({ success: false, message: `Unsupported operation type: ${operationType}` });
      }

      // Execute the FFmpeg command
      if (ffmpegCommand) {
        await execPromise(ffmpegCommand);
        console.log(`FFmpeg command executed for ${operationType}`);
      } else {
        throw new Error('FFmpeg command not generated.');
      }

      // ✅ KEY CHANGE: Replace original file with processed file
      const fullOriginalFilePath = path.join(__dirname, '..', currentInputFilePath);

      // Create backup of original (optional safety measure)
      const backupPath = `${fullOriginalFilePath}.backup`;
      await fs.copyFile(fullOriginalFilePath, backupPath);

      try {
        // Replace original file with processed result
        // ✅ Use tempOutputFilePathFixed for concatenate, tempOutputFilePath for other operations
        const outputPath = operationType === 'concatenate' ? global.tempOutputFilePathFixed : tempOutputFilePath;
        await fs.copyFile(outputPath, fullOriginalFilePath);

        // Get new file metadata
        const newMetadata = await getAudioMetadata(fullOriginalFilePath);

        // ✅ KEY CHANGE: Update existing AudioFile record instead of creating new one
        targetAudioFile.duration = newMetadata.duration;
        targetAudioFile.fileSize = newMetadata.fileSize;
        targetAudioFile.sampleRate = newMetadata.sampleRate;
        targetAudioFile.bitRate = newMetadata.bitRate;
        targetAudioFile.channels = newMetadata.channels;
        targetAudioFile.updatedAt = new Date();

        // Add to edit history (optional)
        if (!targetAudioFile.editHistory) {
          targetAudioFile.editHistory = [];
        }
        targetAudioFile.editHistory.push({
          operation: operationType,
          parameters: operationData,
          timestamp: new Date(),
          previousDuration: currentDuration
        });

        await targetAudioFile.save();

        // Remove backup file if everything succeeded
        await fs.unlink(backupPath);

        // Clean up global variable
        if (global.tempOutputFilePathFixed) {
          delete global.tempOutputFilePathFixed;
        }

      } catch (replaceError) {
        // If replacement failed, restore from backup
        await fs.copyFile(backupPath, fullOriginalFilePath);
        await fs.unlink(backupPath);

        // Clean up global variable
        if (global.tempOutputFilePathFixed) {
          delete global.tempOutputFilePathFixed;
        }

        throw replaceError;
      }

      // Clean up temporary files
      for (const tempFile of tempFilesToClean) {
        try {
          await fs.unlink(tempFile);
        } catch (cleanUpError) {
          console.warn(`Could not delete temporary file ${tempFile}:`, cleanUpError);
        }
      }

      // ✅ KEY CHANGE: Return the updated same file instead of new file
      res.status(200).json({
        success: true,
        message: 'Audio edit applied successfully.',
        data: {
          audioFile: {
            id: targetAudioFile._id,
            originalName: targetAudioFile.originalName,
            fileName: targetAudioFile.fileName,
            duration: targetAudioFile.duration,
            fileUrl: targetAudioFile.fileUrl
          }
        }
      });

    } catch (error) {
      console.error('Error applying single audio edit:', error);
      // Clean up temp files on error
      if (tempFilesToClean && tempFilesToClean.length > 0) {
        for (const tempFile of tempFilesToClean) {
          try {
            await fs.unlink(tempFile);
          } catch (cleanUpError) {
            console.warn(`Could not delete temporary file during error cleanup ${tempFile}:`, cleanUpError);
          }
        }
      }
      res.status(500).json({
        success: false,
        message: `Failed to apply ${req.body.operationType} operation: ${error.message || error.toString() || 'An unknown error occurred'}`,
        error: error.message || error.toString() || 'An unknown error occurred'
      });
    }
  },

  
  saveFinalEditedVersion: async (req, res) => {
    const { sourceAudioFileId, originalName } = req.body;
    const userId = req.user.id;

    if (!sourceAudioFileId || !originalName) {
      return res.status(400).json({ success: false, message: 'Invalid request: sourceAudioFileId and originalName are required.' });
    }

    try {
      const sourceAudioFile = await AudioFile.findById(sourceAudioFileId);
      if (!sourceAudioFile || sourceAudioFile.userId.toString() !== userId.toString()) {
        return res.status(404).json({ success: false, message: 'Source audio file not found or you do not have permission.' });
      }

      const originalFilePath = sourceAudioFile.filePath;
      const newFileName = `${crypto.randomBytes(16).toString('hex')}_${originalName}`;
      const newFilePath = path.join(path.dirname(originalFilePath), newFileName); // Save in the same directory

      // Copy the content of the source (already edited) file to a new file path
      await fs.copyFile(originalFilePath, newFilePath);

      // Get metadata for the new file (which is a copy of the edited one)
      const newMetadata = await getAudioMetadata(newFilePath);

      // Create a new AudioFile document
      const newAudioFile = new AudioFile({
        userId,
        originalName: `${originalName.split('.').slice(0, -1).join('.')}_edited_${Date.now()}${path.extname(originalName)}`, // Append _edited and timestamp
        fileName: path.basename(newFilePath), // Use the crypto-generated filename
        filePath: newFilePath,
        fileSize: newMetadata.fileSize,
        duration: newMetadata.duration,
        mimeType: newMetadata.mimeType,
        format: newMetadata.format,
        sampleRate: newMetadata.sampleRate,
        bitRate: newMetadata.bitRate,
        channels: newMetadata.channels,
        isOriginal: false, // Mark as an edited version
        parentFileId: sourceAudioFileId, // Link to the file it was derived from
        processingStatus: 'completed'
      });

      await newAudioFile.save();

      res.status(201).json({
        success: true,
        message: 'Edited audio file saved successfully as a new version.',
        data: {
          newAudioFile: {
            id: newAudioFile._id,
            originalName: newAudioFile.originalName,
            fileName: newAudioFile.fileName,
            duration: newAudioFile.duration,
            fileUrl: newAudioFile.fileUrl
          }
        }
      });

    } catch (error) {
      console.error('Error saving final edited version:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save final edited version: ' + error.message,
        error: error.message
      });
    }
  },

};



module.exports = audioController;