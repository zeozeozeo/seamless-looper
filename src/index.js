/*
 * TODO: Add the ability to select loops and the minimum difference threshold.
 */

var audioInput = document.getElementById("audio-input");
var looper, wavesurfer, loops;

var browseButton = document.getElementById("browse-button");
var fileChooseBox = document.getElementById("file-choose-box");
var loadingText = document.getElementById("loading-text");
var diffThresholdInput = document.getElementById("diff-threshold");
const DEFAULT_THRESHOLD = 5.5;

function showFileChooseBox() {
    fileChooseBox.style.opacity = 1;
    fileChooseBox.style.display = "block";
    loadingText.style.display = "none";
    diffThresholdInput.value = DEFAULT_THRESHOLD;
}
showFileChooseBox();

browseButton.addEventListener("click", () => {
    var input = document.createElement("input");
    input.type = "file";
    input.click();

    input.onchange = (event) => {
        (function fade() {
            (fileChooseBox.style.opacity -= 0.15) < 0
                ? (fileChooseBox.style.display = "none")
                : setTimeout(fade, 40);
        })();
        handleBrowse(event);
    };
});

function handleBrowse(event) {
    if (event.target.files.length === 0) {
        Swal.fire({
            icon: "error",
            title: "No file selected",
        });
        return;
    }

    showPreview();
    loadingText.style.display = "block";
    var reader = new FileReader();
    reader.onload = (file) => {
        if (typeof wavesurfer != "undefined") {
            wavesurfer.destroy();
        }
        looper = new Looper(
            file.target.result,
            () => {
                loops = looper.analyze();
                if (loops.length === 0) {
                    Swal.fire({
                        icon: "error",
                        title: "Couldn't find any loops!",
                        text: "Try changing the minimum difference or try an another song.",
                    });
                    showFileChooseBox();
                    return;
                } else {
                    initUI();
                }
            },
            diffThresholdInput.value
        );
    };
    reader.readAsArrayBuffer(event.target.files[0]);
}

function toSeconds(samples) {
    if (typeof looper == "undefined" || looper.bufferLength == 0) return 0;
    return samples / looper.sampleRate;
}

// blurred preview image
const waveformPreview = document.getElementById("waveform-preview");
function showPreview() {
    waveformPreview.style.opacity = 1;
    waveformPreview.style.display = "block";
}
function hidePreview() {
    (function fade() {
        (waveformPreview.style.opacity -= 0.1) < 0
            ? (waveformPreview.style.display = "none")
            : setTimeout(fade, 40);
    })();
}

function initUI() {
    const loopStart = toSeconds(loops[0].start);
    const loopEnd = toSeconds(loops[0].end);

    wavesurfer = WaveSurfer.create({
        container: "#waveform",
        waveColor: "#808080",
        progressColor: "orange",
        cursorColor: "white",
        barWidth: 4,
        partialRender: true,
        responsive: true,
        scrollParent: true,
        height: window.innerHeight / 4,
        normalize: true,
        hideScrollbar: true,
        autoCenter: true,
        minPxPerSec: 70,
        plugins: [
            WaveSurfer.markers.create({
                markers: [
                    {
                        time: loopStart,
                        label: "Loop start",
                        color: "#ff990a",
                    },
                    {
                        time: loopEnd,
                        label: "Loop end",
                        color: "#00ffcc",
                        position: "top",
                    },
                ],
            }),
        ],
    });

    wavesurfer.on("ready", () => {
        hidePreview();
        loadingText.style.display = "none";
        wavesurfer.play(loopStart);
    });

    wavesurfer.on("audioprocess", (time) => {
        if (time < loopStart || time >= loopEnd) {
            if (wavesurfer.isPlaying()) {
                wavesurfer.pause();
            }
            wavesurfer.play(loopStart);
        }
    });

    wavesurfer.loadBlob(looper.blob);
}

document.getElementById("info-text").addEventListener("click", () => {
    Swal.fire({
        title: "Seamless Looper",
        html: `
        <ul>
            <li>
                Finds seamless loops in music.
            </li>
            <li>
                Works best with electronic music.
            </li>
            <li>
                You can interact with the waveform with your mouse.
            </li>
            <li>
                The algorithm:
                <ul>
                    <li>
                        1. Find BPM, starting beat and beat offset for the song.
                    </li>
                    <li>
                        2. Split the song into chunks, the size of one chunk
                        is the amount of samples between two beats.
                    </li>
                    <li>
                        3. For each chunk, iterate through every other chunk
                        and find their difference. If the difference is bigger than
                        a certain threshold, skip it.
                    </li>
                    <li>
                        4. Add the start and the end of the 2 matching chunks to an array of loops.
                    </li>
                    <li>
                        5. Sort the array by biggest loops (not ideal, but that works).
                    </li>
                </ul>
            </li>
        </ul
        `,
    });
});
