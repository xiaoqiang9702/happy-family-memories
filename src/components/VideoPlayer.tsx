interface Video {
  src: string
  title: string
}

export default function VideoPlayer({ videos }: { videos: Video[] }) {
  if (videos.length === 0) return null

  return (
    <div className="space-y-4">
      {videos.map((video, index) => (
        <div key={index} className="rounded-2xl overflow-hidden bg-black">
          <video
            src={video.src}
            controls
            playsInline
            preload="metadata"
            className="w-full"
            controlsList="nodownload"
          >
            您的浏览器不支持视频播放
          </video>
          {video.title && (
            <div className="bg-warm-100 px-4 py-3 text-base text-warm-700 font-medium">
              🎬 {video.title}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
