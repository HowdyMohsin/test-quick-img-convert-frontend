// Per-pair copy generated from format metadata so each pair page is unique.
import type { FormatInfo } from './catalog';

export function pairDescription(from: FormatInfo, to: FormatInfo): string {
  return `Convert ${from.label} to ${to.label} online for free — no software to install. Upload your ${from.label} file, adjust the ${to.label} settings if you need to, and download the result in seconds. Files are deleted automatically after 24 hours.`;
}

export function pairFaqs(from: FormatInfo, to: FormatInfo) {
  return [
    { q: `Is the ${from.label} to ${to.label} converter free?`, a: `Yes. You can convert ${from.label} to ${to.label} for free — anonymous visitors get 5 conversions a day, and a free account raises that to 25 a day with conversion history.` },
    { q: `Do I need to install anything to convert ${from.label} to ${to.label}?`, a: `No. The converter runs entirely in your browser and on our servers. Just upload your ${from.label} file and download the ${to.label} result — nothing to install on Windows, Mac, or Linux.` },
    { q: `Will my ${from.label} file lose quality when converted to ${to.label}?`, a: to.category === 'Images' || from.category === 'Images'
      ? `It depends on the settings you choose. For the best quality, keep the quality slider high and the original resolution. ${to.label} is ${to.slug === 'jpg' ? 'a lossy format, so a small amount of quality is traded for a much smaller file' : 'a high-quality target for this conversion'}.`
      : `The converter uses sensible defaults for ${to.label} output. You can adjust quality, bitrate, or resolution in the settings panel before converting.` },
    { q: `How long does a ${from.label} to ${to.label} conversion take?`, a: `Most files convert in a few seconds. Larger files — especially video and camera RAW — can take longer, and you can watch the progress for each file while it converts.` },
    { q: `Are my files private?`, a: `Yes. Uploads travel over secure HTTPS and every file — input and output — is deleted automatically after 24 hours. We never share your files with anyone.` },
    { q: `Can I convert several ${from.label} files to ${to.label} at once?`, a: `Yes, batch conversion is supported. Drop up to your plan's batch limit of files at once and download them all together as a ZIP.` },
  ];
}

export function pairUseCases(from: FormatInfo, to: FormatInfo) {
  const cat = from.category;
  const base: { title: string; body: string }[] = [];
  if (cat === 'Images' || cat === 'Camera RAW') {
    base.push(
      { title: `Share ${from.label} photos anywhere`, body: `${to.label} is supported by every app and website, so converting makes your ${from.label} photos easy to share, attach, and post.` },
      { title: 'Shrink large photos for the web', body: `Convert to ${to.label} with the quality slider to cut file size dramatically while keeping photos looking sharp.` },
      { title: 'Prepare images for print', body: `Choose a lossless or high-quality ${to.label} output and the right resolution for crisp printed results.` },
      { title: 'Fix compatibility problems', body: `Some apps and older devices cannot open ${from.label}. A quick conversion to ${to.label} solves it in seconds.` },
    );
  } else if (cat === 'Audio') {
    base.push(
      { title: `Play ${from.label} on any device`, body: `${to.label} works on phones, cars, and players that do not support ${from.label}.` },
      { title: 'Make audio smaller for sharing', body: `Convert to ${to.label} at a lower bitrate to shrink recordings and music for email or messaging.` },
      { title: 'Prepare audio for editing', body: `Convert ${from.label} to ${to.label} so it opens cleanly in your editor of choice.` },
      { title: 'Archive recordings', body: `Keep a compact ${to.label} copy of every ${from.label} recording without losing the moments that matter.` },
    );
  } else if (cat === 'Video') {
    base.push(
      { title: `Share ${from.label} video anywhere`, body: `${to.label} plays on every phone, browser, and social network — no "format not supported" errors.` },
      { title: 'Shrink video for upload', body: `Convert to ${to.label} with a smaller resolution or higher CRF to make uploads fast and storage cheap.` },
      { title: 'Extract the audio track', body: to.slug === 'mp3' ? 'Pull the soundtrack out of your video as an MP3 you can listen to anywhere.' : `Convert your ${from.label} clip to ${to.label} for easy playback and editing.` },
      { title: 'Prepare video for editing', body: `Convert ${from.label} to a widely supported ${to.label} file your editor can open without transcoding delays.` },
    );
  } else {
    base.push(
      { title: `Open ${from.label} anywhere`, body: `${to.label} is supported by far more apps and devices than ${from.label}, so conversion removes compatibility friction.` },
      { title: 'Share documents and graphics', body: `Convert ${from.label} to ${to.label} and send it to anyone — they can open it without special software.` },
      { title: 'Extract pages and images', body: `Turn ${from.label} content into ${to.label} files you can reuse in presentations, websites, and documents.` },
      { title: 'Archive in a standard format', body: `Keep a ${to.label} copy of your ${from.label} files so they stay readable for years.` },
    );
  }
  return base;
}

export function pairProblems(from: FormatInfo, to: FormatInfo) {
  return [
    { q: `My ${from.label} file will not upload`, a: `Check the file size against your plan limit and make sure the file really is a ${from.label} file — the extension alone is not enough, the file contents are checked. Try a smaller file or a different browser if the problem continues.` },
    { q: 'The conversion failed', a: `Large or damaged source files are the most common cause. Try the file again, or re-export it from the app that created it and convert the fresh copy.` },
    { q: 'The output looks different from the original', a: `Some formats store colour, transparency, or layers differently. For images, check the quality and background settings; for video, check the resolution preset before converting.` },
    { q: 'The download did not start', a: `Downloads are available for 24 hours after conversion. If your browser blocked the download, allow downloads from this site and try again, or use the Download all (.zip) button.` },
  ];
}
