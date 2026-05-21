import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Pipe({
  name: 'safeYoutube',
  standalone: true
})
export class SafeYoutubePipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(url: string | undefined | null): SafeResourceUrl | null {
    if (!url) return null;

    let videoId = '';
    
    // Matches formats:
    // https://www.youtube.com/watch?v=XXXXXX
    // https://youtu.be/XXXXXX
    // https://www.youtube.com/shorts/XXXXXX
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|\/shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);

    if (match && match[2].length === 11) {
      videoId = match[2];
    }

    if (videoId) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${videoId}`);
    }

    // Fallback just sanitize
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
