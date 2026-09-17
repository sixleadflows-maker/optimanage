"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X, RotateCcw, Check, Loader2, CameraOff } from "lucide-react";

// Photos go straight into the product; anything bigger than this is wasted
// bandwidth on a shop laptop and a slow page for whoever opens the product.
const MAX_EDGE = 1600;

function cameraProblem(e: unknown) {
  const name = typeof e === "object" && e !== null ? (e as { name?: string }).name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "The browser is blocking the camera. Click the camera icon in the address bar, allow it for this site, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera found on this computer.";
  if (name === "NotReadableError") return "The camera is already in use by another program — close it and try again.";
  return "Couldn't start the camera on this computer.";
}

export function CameraCapture({
  onCapture,
  onClose,
  busy = false,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);
  const [shot, setShot] = useState<{ url: string; file: File } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      // getUserMedia only exists on https and localhost.
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("The camera needs a secure (https) connection to this site.");
        setStarting(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        if (!cancelled) setError(cameraProblem(e));
      } finally {
        if (!cancelled) setStarting(false);
      }
    };
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const take = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
        setShot({ url: URL.createObjectURL(blob), file });
        stopCamera();
      },
      "image/jpeg",
      0.85
    );
  };

  const retake = () => {
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null);
    setStarting(true);
    setError("");
    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(async (stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      })
      .catch((e) => setError(cameraProblem(e)))
      .finally(() => setStarting(false));
  };

  const close = () => {
    if (shot) URL.revokeObjectURL(shot.url);
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="glass-modal w-full max-w-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" /> Take a photo
          </h3>
          <button onClick={close} className="p-1 rounded-lg hover:bg-surface-hover">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center">
          {error ? (
            <div className="text-center px-6">
              <CameraOff className="w-8 h-8 text-white/50 mx-auto mb-3" />
              <p className="text-xs text-white/80">{error}</p>
            </div>
          ) : shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot.url} alt="Captured product" className="w-full h-full object-contain" />
          ) : (
            <>
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              {starting && <Loader2 className="w-6 h-6 text-white animate-spin absolute" />}
            </>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          {shot ? (
            <>
              <button
                onClick={retake}
                disabled={busy}
                className="flex-1 py-2.5 glass-card text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <RotateCcw className="w-4 h-4" /> Retake
              </button>
              <button
                onClick={() => onCapture(shot.file)}
                disabled={busy}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {busy ? "Saving..." : "Use this photo"}
              </button>
            </>
          ) : (
            <>
              <button onClick={close} className="flex-1 py-2.5 glass-card text-sm font-medium">
                Cancel
              </button>
              <button
                onClick={take}
                disabled={!!error || starting}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Camera className="w-4 h-4" /> Capture
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
