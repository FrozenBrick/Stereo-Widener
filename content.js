(function() {
    if (window.AudioFXActive) return console.log("Audio FX already active.");
    
    // --- GLOBAL STATE ---
    const fxState = {
        widener: { enabled: true, width: 2.0 },
        depth: { enabled: true, strength: 800 }
    };

    // --- DSP VARIABLES (For Depth Effect) ---
    // Circular buffers for delay lines
    const BUFFER_SIZE = 512; // Power of 2, large enough for 140 samples
    const BUFFER_MASK = BUFFER_SIZE - 1;
    const delayBuffer0 = new Float32Array(BUFFER_SIZE);
    const delayBuffer1 = new Float32Array(BUFFER_SIZE);
    let writePtr = 0;
    
    // Feedback state
    let prev0 = 0.0;
    let prev1 = 0.0;

    // --- SETUP AUDIO ---
    const media = document.querySelector('video') || document.querySelector('audio');
    if (!media) return alert('No audio source found!');

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        const source = ctx.createMediaElementSource(media);
        const processor = ctx.createScriptProcessor(4096, 2, 2);

        // --- MESSAGE LISTENER ---
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.action === "UPDATE_FX") {
                fxState.widener = msg.widener;
                fxState.depth = msg.depth;
            }
        });

        // --- THE AUDIO ENGINE ---
        processor.onaudioprocess = function(e) {
            const inL = e.inputBuffer.getChannelData(0);
            const inR = e.inputBuffer.getChannelData(1);
            const outL = e.outputBuffer.getChannelData(0);
            const outR = e.outputBuffer.getChannelData(1);
            
            // Pre-calculate Depth Params
            let depthGain = 0;
            let depthInvert = false;
            
            if (fxState.depth.enabled) {
                // Formula from your script: pow(10, ((strength / 1000) * 10 - 15) / 20)
                const s = fxState.depth.strength;
                depthInvert = s >= 500;
                let db = ((s / 1000.0) * 10.0) - 15.0;
                depthGain = Math.pow(10, db / 20.0);
                if (Math.abs(depthGain) > 1.0) depthGain = 1.0;
            }

            // Pre-calculate Widener Params
            const widthCoef = fxState.widener.enabled ? fxState.widener.width * 0.5 : 0;

            // SAMPLE LOOP
            for (let i = 0; i < inL.length; i++) {
                let L = inL[i];
                let R = inR[i];

                // --- 1. DEPTH SURROUND PROCESSING ---
                if (fxState.depth.enabled) {
                    // Delay 0 (20 samples)
                    // Delay 1 (140 samples)
                    const delay0Idx = (writePtr - 20) & BUFFER_MASK;
                    const delay1Idx = (writePtr - 140) & BUFFER_MASK;
                    
                    // Logic from JSFX:
                    // prev0 = gain * delay0.read(L + prev1)
                    // prev1 = gain * delay1.read(R + prev0)
                    
                    // Write inputs to buffer (adding feedback)
                    delayBuffer0[writePtr] = L + prev1;
                    delayBuffer1[writePtr] = R + prev0;

                    // Read delays
                    const delayed0 = delayBuffer0[delay0Idx];
                    const delayed1 = delayBuffer1[delay1Idx];

                    // Apply Gain
                    prev0 = depthGain * delayed0;
                    prev1 = (depthInvert ? -depthGain : depthGain) * delayed1;

                    // Mix Wet + Dry
                    L = prev0 + L;
                    R = prev1 + R;
                    
                    writePtr = (writePtr + 1) & BUFFER_MASK;
                }

                // --- 2. STEREO WIDENER PROCESSING ---
                if (fxState.widener.enabled) {
                    const m = (L + R) * 0.5;
                    const s = (R - L) * widthCoef;
                    L = m - s;
                    R = m + s;
                }

                // Output
                outL[i] = L;
                outR[i] = R;
            }
        };

        source.connect(processor);
        processor.connect(ctx.destination);
        
        window.AudioFXActive = true;
        console.log("Audio FX Engine Loaded.");

    } catch (err) {
        console.error(err);
        alert("Error: " + err.message + "\n(Enable CORS extension for YouTube!)");
    }
})();