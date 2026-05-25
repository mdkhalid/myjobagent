import { Component, inject, output, input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ResumeService, Resume } from '../../../core/services/resume.service';
import { PersonalInfo, SearchFilterOptions, JobSource } from '../../../core/services/linkedin.service';

@Component({
  selector: 'app-job-search-config-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatInputModule,
    MatSelectModule, MatChipsModule, MatSlideToggleModule, MatDividerModule,
    MatExpansionModule, MatProgressSpinnerModule,
  ],
  template: `
    <mat-card class="config-card">
      <mat-card-header>
        <mat-card-title><mat-icon>tune</mat-icon> Search Configuration</mat-card-title>
        <mat-card-subtitle>Search across multiple free job board APIs — no browser setup needed</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="form" class="config-form">

          <!-- Search Terms -->
          <div class="form-section">
            <h3><mat-icon>search</mat-icon> Search Terms</h3>
            <div class="form-row">
              <mat-form-field appearance="outline" class="flex-2">
                <mat-label>Search Terms (comma-separated)</mat-label>
                <input matInput formControlName="searchTerms"
                       placeholder="Software Engineer, Python Developer">
                <mat-hint>Multiple terms separated by commas</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Location</mat-label>
                <input matInput formControlName="location" placeholder="Remote, United States">
              </mat-form-field>
            </div>
          </div>

          <mat-divider></mat-divider>

          <!-- Source selection -->
          <div class="form-section">
            <h3><mat-icon>dns</mat-icon> Data Sources</h3>
            <div class="form-row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Job Board Sources</mat-label>
                <mat-select formControlName="sources" multiple>
                  <mat-option *ngFor="let s of sources()" [value]="s.id">
                    {{ s.label }} <span *ngIf="s.requires_api_key" class="key-needed">(API key needed)</span>
                  </mat-option>
                </mat-select>
                <mat-hint>Select which job boards to search (empty = all free APIs)</mat-hint>
              </mat-form-field>
            </div>
          </div>

          <mat-divider></mat-divider>

          <!-- Filters -->
          <div class="form-section">
            <h3><mat-icon>filter_list</mat-icon> Job Filters</h3>
            <div class="form-row triple">
              <mat-form-field appearance="outline">
                <mat-label>Job Type</mat-label>
                <mat-select formControlName="jobType" multiple>
                  <mat-option value="full-time">Full-time</mat-option>
                  <mat-option value="part-time">Part-time</mat-option>
                  <mat-option value="contract">Contract</mat-option>
                  <mat-option value="internship">Internship</mat-option>
                  <mat-option value="remote">Remote</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Bad Words (exclude)</mat-label>
                <input matInput formControlName="badWords" placeholder="US Citizen, .NET">
                <mat-hint>Comma-separated keywords to exclude</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Company Good Words</mat-label>
                <input matInput formControlName="goodWords" placeholder="(empty = include all)">
                <mat-hint>Only include these companies</mat-hint>
              </mat-form-field>
            </div>
          </div>

          <mat-divider></mat-divider>

          <!-- Resume -->
          <div class="form-section">
            <h3><mat-icon>description</mat-icon> Resume</h3>
            <p class="hint-text" *ngIf="selectedResumeData()">
              Skills from resume will be used as search terms and for match scoring
            </p>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Select Resume</mat-label>
              <mat-select formControlName="selectedResume" (selectionChange)="onResumeChange($event.value)">
                <mat-option [value]="null">None (manual search terms)</mat-option>
                <mat-option *ngFor="let r of resumes()" [value]="r.id">
                  {{ r.filename }} {{ r.is_active ? '(Active)' : '' }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Resume skills chips (shown when resume selected) -->
            <div *ngIf="selectedResumeData()" class="resume-skills-section">
              <span class="skills-label">Resume Skills:</span>
              <mat-chip-set>
                <mat-chip *ngFor="let skill of selectedResumeData()?.skills?.slice(0, 12) || []"
                          [class]="skillChipClass(skill)" (click)="toggleSkillTerm(skill)">
                  {{ skill }}
                  <mat-icon matChipRemove *ngIf="isSkillSelected(skill)" (click)="$event.stopPropagation(); toggleSkillTerm(skill)">cancel</mat-icon>
                </mat-chip>
              </mat-chip-set>
              <button mat-button size="small" (click)="autoFillFromResume()" *ngIf="selectedResumeData()">
                <mat-icon>auto_fix_high</mat-icon> Auto-fill Search Terms
              </button>
            </div>
            <!-- Parsed info summary when resume selected -->
            <div *ngIf="selectedResumeData()" class="resume-summary">
              <span class="info-chip"><mat-icon>work_history</mat-icon> {{ selectedResumeData()?.experience_years || 0 }} yrs exp</span>
              <span class="info-chip"><mat-icon>category</mat-icon> {{ selectedResumeData()?.skills?.length || 0 }} skills</span>
            </div>
          </div>

          <mat-divider></mat-divider>

          <!-- Personal Info -->
          <mat-accordion class="personal-info-accordion">
            <mat-expansion-panel>
              <mat-expansion-panel-header>
                <mat-panel-title><mat-icon>person</mat-icon> Personal Information</mat-panel-title>
                <mat-panel-description>For application tracking</mat-panel-description>
              </mat-expansion-panel-header>
              <div class="personal-form">
                <div class="form-row triple">
                  <mat-form-field appearance="outline"><mat-label>First Name</mat-label><input matInput formControlName="firstName"></mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Last Name</mat-label><input matInput formControlName="lastName"></mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Phone</mat-label><input matInput formControlName="phone" type="tel"></mat-form-field>
                </div>
                <div class="form-row triple">
                  <mat-form-field appearance="outline"><mat-label>Email</mat-label><input matInput formControlName="email" type="email"></mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>City</mat-label><input matInput formControlName="city"></mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Years Exp.</mat-label><input matInput formControlName="experienceYears" type="number"></mat-form-field>
                </div>
                <div class="form-row triple">
                  <mat-form-field appearance="outline"><mat-label>Desired Salary</mat-label><input matInput formControlName="desiredSalary"></mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Notice (days)</mat-label><input matInput formControlName="noticePeriod" type="number"></mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Current CTC</mat-label><input matInput formControlName="currentCtc"></mat-form-field>
                </div>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>LinkedIn URL</mat-label>
                  <input matInput formControlName="linkedinUrl" placeholder="https://www.linkedin.com/in/...">
                </mat-form-field>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Portfolio / Website</mat-label>
                  <input matInput formControlName="website">
                </mat-form-field>
              </div>
            </mat-expansion-panel>
          </mat-accordion>
        </form>
      </mat-card-content>
      <mat-card-actions align="end">
        <button mat-stroked-button (click)="reset.emit()"><mat-icon>refresh</mat-icon> Reset</button>
        <button mat-raised-button color="primary" (click)="onSearch()"
                [disabled]="form.invalid || searching()" class="search-btn">
          <mat-spinner *ngIf="searching()" diameter="20"></mat-spinner>
          <mat-icon *ngIf="!searching()">travel_explore</mat-icon>
          {{ searching() ? 'Searching...' : 'Search Jobs' }}
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    .config-card { }
    mat-card-title { display: flex; align-items: center; gap: 8px; }
    .config-form { display: flex; flex-direction: column; gap: 16px; padding-top: 16px; }
    .form-section h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; margin-bottom: 16px; color: var(--text); }
    .form-section h3 mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--primary-light); }
    .form-row { display: flex; gap: 16px; margin-bottom: 16px; }
    .form-row.triple > * { flex: 1; }
    .flex-1 { flex: 1; }
    .flex-2 { flex: 2; }
    .key-needed { font-size: 11px; color: var(--text-muted); }
    .personal-info-accordion { margin-top: 8px; }
    .personal-info-accordion .mat-expansion-panel { background: var(--bg-card) !important; color: var(--text) !important; border: 1px solid var(--border) !important; border-radius: var(--radius-md) !important; }
    .personal-info-accordion mat-panel-title { display: flex; align-items: center; gap: 8px; }
    .personal-form { display: flex; flex-direction: column; gap: 12px; padding-top: 16px; }
    .full-width { width: 100%; }
    .hint-text { font-size: 13px; color: var(--text-secondary); margin: -8px 0 12px; }
    .search-btn { display: flex; align-items: center; gap: 8px; height: 48px; font-size: 16px; padding: 0 32px; }
    .resume-skills-section { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 8px 0; }
    .skills-label { font-size: 13px; color: var(--text-secondary); font-weight: 500; margin-right: 4px; }
    .skill-chip { cursor: pointer; transition: all var(--transition); }
    .skill-chip.selected { background: var(--primary) !important; color: white !important; }
    .resume-summary { display: flex; gap: 16px; margin-top: 8px; }
    .info-chip { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--text-secondary); background: rgba(148, 163, 184, 0.08); padding: 4px 12px; border-radius: 16px; }
    .info-chip mat-icon { font-size: 16px; width: 16px; height: 16px; }
    @media (max-width: 768px) { .form-row { flex-direction: column; } .form-row.triple { flex-direction: column; } }
  `],
})
export class JobSearchConfigFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private resumeService = inject(ResumeService);

  readonly searching = input(false);
  readonly sources = input<JobSource[]>([]);
  readonly search = output<{ formData: any; personalInfo: PersonalInfo; filters: SearchFilterOptions }>();
  readonly reset = output<void>();

  resumes = signal<Resume[]>([]);
  selectedResumeData = signal<Resume | null>(null);
  selectedSkillTerms = signal<Set<string>>(new Set());
  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      searchTerms: ['Software Engineer, Python Developer', Validators.required],
      location: ['Remote'],
      sources: [[]],
      jobType: [['full-time']],
      badWords: [''],
      goodWords: [''],
      selectedResume: [null],
      firstName: [''], lastName: [''], phone: [''], email: [''],
      city: [''], experienceYears: [''], desiredSalary: [''],
      noticePeriod: [''], currentCtc: [''], linkedinUrl: [''],
      website: [''],
    });
  }

  ngOnInit(): void {
    this.resumeService.getResumes().subscribe({
      next: (resumes) => {
        this.resumes.set(resumes);
        const active = resumes.find(r => r.is_active);
        if (active) {
          this.form.patchValue({ selectedResume: active.id });
          this.onResumeChange(active.id);
        }
      },
    });
  }

  onResumeChange(resumeId: string | null): void {
    if (!resumeId) {
      this.selectedResumeData.set(null);
      this.selectedSkillTerms.set(new Set());
      return;
    }
    const resume = this.resumes().find(r => r.id === resumeId) || null;
    this.selectedResumeData.set(resume);
    // Auto-fill search terms from resume skills
    if (resume && resume.skills?.length > 0) {
      this.autoFillFromResume();
    }
  }

  autoFillFromResume(): void {
    const resume = this.selectedResumeData();
    if (!resume || !resume.skills?.length) return;

    // Use top 6 skills as search terms, grouped into 2-3 skill clusters
    const skills = resume.skills.slice(0, 9);
    const terms: string[] = [];
    for (let i = 0; i < skills.length; i += 3) {
      terms.push(skills.slice(i, i + 3).join(' '));
    }
    if (terms.length === 0) {
      terms.push(skills.slice(0, 3).join(' '));
    }
    this.form.patchValue({ searchTerms: terms.join(', ') });
    this.selectedSkillTerms.set(new Set(skills.slice(0, 9)));
  }

  toggleSkillTerm(skill: string): void {
    const current = new Set(this.selectedSkillTerms());
    if (current.has(skill)) {
      current.delete(skill);
    } else {
      current.add(skill);
    }
    this.selectedSkillTerms.set(current);

    // Update search terms from selected skills
    const selected = Array.from(current);
    if (selected.length > 0) {
      const terms: string[] = [];
      for (let i = 0; i < selected.length; i += 3) {
        terms.push(selected.slice(i, i + 3).join(' '));
      }
      this.form.patchValue({ searchTerms: terms.join(', ') });
    }
  }

  isSkillSelected(skill: string): boolean {
    return this.selectedSkillTerms().has(skill);
  }

  skillChipClass(skill: string): string {
    return this.isSkillSelected(skill) ? 'skill-chip selected' : 'skill-chip';
  }

  onSearch(): void {
    if (this.form.invalid) return;
    const v = this.form.value;

    const filters: SearchFilterOptions = {};
    if (v.jobType?.length) filters.job_type = v.jobType;
    if (v.badWords) filters.bad_words = v.badWords.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (v.goodWords) filters.about_company_good_words = v.goodWords.split(',').map((s: string) => s.trim()).filter(Boolean);

    const personalInfo: PersonalInfo = {};
    if (v.firstName) personalInfo.first_name = v.firstName;
    if (v.lastName) personalInfo.last_name = v.lastName;
    if (v.phone) personalInfo.phone_number = v.phone;
    if (v.email) personalInfo.email = v.email;
    if (v.city) personalInfo.current_city = v.city;
    if (v.experienceYears) personalInfo.experience_years = v.experienceYears;
    if (v.desiredSalary) personalInfo.desired_salary = v.desiredSalary;
    if (v.noticePeriod) personalInfo.notice_period = v.noticePeriod;
    if (v.currentCtc) personalInfo.current_ctc = v.currentCtc;
    if (v.linkedinUrl) personalInfo.linkedin_url = v.linkedinUrl;
    if (v.website) personalInfo.website = v.website;

    this.search.emit({ formData: v, personalInfo, filters });
  }
}
