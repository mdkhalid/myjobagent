import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Resume {
  id: string;
  filename: string;
  file_path: string;
  parsed_content: any;
  skills: string[];
  experience_years: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class ResumeService {
  private http = inject(HttpClient);
  private apiUrl = '/api/v1/resumes/';

  getResumes(): Observable<Resume[]> {
    return this.http.get<Resume[]>(this.apiUrl);
  }

  uploadResume(file: File): Observable<Resume> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Resume>(`${this.apiUrl}upload`, formData);
  }

  deleteResume(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}`);
  }

  setActiveResume(id: string): Observable<Resume> {
    return this.http.post<Resume>(`${this.apiUrl}${id}/set-active`, {});
  }

  getParsedResume(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}${id}/parsed`);
  }
}
