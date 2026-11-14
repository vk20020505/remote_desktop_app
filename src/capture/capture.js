// Hidden window: captures the screen once and shares it with each watching phone
// over its own WebRTC peer connection. Signaling goes through the main process.
const peers = new Map(); // phone id -> RTCPeerConnection
let stream = null;       // Promise<MediaStream> shared by all peers
let streamSource = null;

function getStream(sourceId, fps) {
  if (stream && streamSource === sourceId) return stream;
  stopStream();
  streamSource = sourceId;
  stream = navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId: sourceId, maxFrameRate: fps } },
  }).then((s) => {
    s.getVideoTracks().forEach((t) => { t.contentHint = "detail"; }); // keep text sharp
    return s;
  });
  stream.catch(() => { stream = null; streamSource = null; });
  return stream;
}

function stopStream() {
  if (stream) stream.then((s) => s.getTracks().forEach((t) => t.stop()), () => {});
  stream = null;
  streamSource = null;
}

function close(id, notify) {
  const pc = peers.get(id);
  if (!pc) return;
  peers.delete(id);
  pc.close();
  if (notify) window.capture.closed(id);
  if (peers.size === 0) stopStream();
}

/** Resolves once all local ICE candidates are in the SDP (LAN only, so this is quick). */
function iceGathered(pc) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(done, 3000);
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") done();
    });
  });
}

window.capture.onStart(async ({ id, sourceId, maxWidth, fps }) => {
  close(id, false);
  try {
    const media = await getStream(sourceId, fps);
    const [track] = media.getVideoTracks();
    const pc = new RTCPeerConnection({ iceServers: [] }); // same Wi-Fi: host candidates are enough
    peers.set(id, pc);
    pc.addEventListener("connectionstatechange", () => {
      if (["failed", "closed"].includes(pc.connectionState) && peers.get(id) === pc) close(id, true);
    });

    const sender = pc.addTransceiver(track, { direction: "sendonly", streams: [media] }).sender;
    const { width } = track.getSettings();
    const params = sender.getParameters();
    params.degradationPreference = "maintain-resolution";
    params.encodings = [{
      maxFramerate: fps,
      maxBitrate: 6_000_000,
      scaleResolutionDownBy: width && maxWidth ? Math.max(1, width / maxWidth) : 1,
    }];
    await sender.setParameters(params).catch(() => {});

    await pc.setLocalDescription(await pc.createOffer());
    await iceGathered(pc);
    if (peers.get(id) !== pc) return; // stopped meanwhile
    window.capture.offer(id, pc.localDescription.sdp);
  } catch (e) {
    close(id, false);
    window.capture.failed(id, e && e.message ? e.message : e);
  }
});

window.capture.onAnswer(async (id, sdp) => {
  const pc = peers.get(id);
  if (!pc) return;
  try {
    await pc.setRemoteDescription({ type: "answer", sdp });
  } catch (e) {
    close(id, true);
  }
});

window.capture.onStop((id) => close(id, false));
