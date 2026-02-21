import { Injectable } from '@nestjs/common';
import * as Diff from 'diff';

@Injectable()
export class FaqVersionService {
  generateDiff(oldContent: string, newContent: string) {
    return Diff.diffWords(oldContent, newContent);
  }
}
