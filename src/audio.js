/*
 * TODO: Crossfades, better loop recognition, optimization.
 */

if (typeof AudioContext == "function") {
    var audioContext = new AudioContext();
} else if (typeof webkitAudioContext == "function") {
    // safari
    var audioContext = new webkitAudioContext();
}

function Looper(data, onready, maxDiff) {
    this.blob = new window.Blob([new Uint8Array(data)]);

    // convert the audio data into an audiobuffer
    audioContext.decodeAudioData(
        data,
        (decoded) => {
            this.sampleRate = decoded.sampleRate;
            this.buffer = decoded.getChannelData(0);
            var beatDetect = new BeatDetect({
                sampleRate: this.sampleRate,
                log: false, // Debug BeatDetect execution with logs
                perf: false, // Attach elapsed time to result object
                round: false, // To have an integer result for the BPM
                float: 4, // The floating precision in [1, Infinity]
                lowPassFreq: 150, // Low pass filter cut frequency
                highPassFreq: 100, // High pass filter cut frequency
                bpmRange: [90, 180], // The BPM range to output
                timeSignature: 4, // The number of beat in a measure
            });

            // XXX: since BeatDetect.js only accepts URL's, we should create
            // an object URL
            const fileURL = window.URL.createObjectURL(this.blob);
            beatDetect
                .getBeatInfo({
                    url: fileURL,
                })
                .then((info) => {
                    this.bpm = info.bpm;
                    this.offset = info.offset;
                    this.firstBar = info.firstBar;

                    if (typeof onready == "function") {
                        onready();
                    }
                })
                .catch((err) => {
                    Swal.fire({
                        icon: "error",
                        title: "Error while detecting BPM!",
                        text: err,
                    }).then(() => {
                        showFileChooseBox();
                    });
                    return;
                });
        },
        (err) => {
            Swal.fire({
                icon: "error",
                title: "Error while decoding audio data!",
                text: err,
            }).then(() => {
                showFileChooseBox();
            });
            return;
        }
    );

    this.analyze = () => {
        // calculate the size of each chunk in samples:
        // (60s / 120bpm) * 48000sr
        const chunkSize = (60 / this.bpm) * this.sampleRate;
        // sample number of the first beat
        // const startSample = this.firstBar * this.sampleRate;
        const startSample =
            this.firstBar * this.sampleRate + this.offset * this.sampleRate;
        const songLength = this.buffer.length - startSample;

        // split audio into chunks
        var chunks = [];
        for (var i = startSample; i < this.buffer.length; i += chunkSize) {
            const chunkData = this.buffer.slice(i, i + chunkSize);
            chunks.push({
                start: i,
                end: i + chunkData.length,
                data: chunkData,
            });
        }

        // find loops
        var loops = [];
        for (var i = 0; i < chunks.length; i++) {
            for (var j = 0; j < chunks.length && i !== j; j++) {
                const chunk1 = chunks[i];
                const chunk2 = chunks[j];
                const length = Math.abs(chunk2.end - chunk1.start);
                if (Math.abs(length - songLength) <= this.sampleRate) continue;
                const diff = chunksDifference(chunk1.data, chunk2.data);

                if (diff <= maxDiff) {
                    const loopStart = chunk2.end.clamp(0, this.buffer.length);
                    const loopEnd = chunk1.start.clamp(0, this.buffer.length);

                    loops.push({
                        start: loopStart,
                        end: loopEnd,
                        length: length,
                        data: this.buffer.slice(loopStart, loopEnd),
                        diff: diff,
                    });
                }
            }
        }
        return sortLoops(loops, this.sampleRate);
    };
}

// difference between two arrays
function chunksDifference(a, b) {
    var diff = 0;
    for (var i = 0; i < a.length && i < b.length; i++) {
        diff += Math.abs(a[i] - b[i]);
    }
    return diff;
}

function sortLoops(loops, sampleRate) {
    return loops
        .sort((a, b) => {
            // sort loops by biggest to smallest
            const length = b.length - a.length;
            // if the length difference is smaller than 5 seconds,
            // sort by best difference instead (TODO: check if this works)
            if (Math.abs(length) < sampleRate * 5) {
                return a.diff - b.diff;
            }
            return length;
        })
        .filter((loop) => {
            for (var i = 0; i < loop.data.length; i++) {
                // get rid of silent loops
                if (loop.data[i] > 0.05) {
                    return true;
                }
                return false;
            }
        });
}

Number.prototype.clamp = function (min, max) {
    return Math.min(Math.max(this, min), max);
};
