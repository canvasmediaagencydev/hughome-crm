# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hughome CRM is a loyalty platform with LINE Login integration built with Next.js 15, React 19, TypeScript, and Supabase. The system enables users (contractors/homeowners) to upload receipts via OCR, earn points, and redeem rewards through an admin-approved workflow.

## Common Development Commands

```bash
# Development server (with Turbopack for faster builds)
npm run dev

# Production build (with Turbopack optimization)  
npm run build

# Production server
npm start

# Database type generation (when schema changes)
supabase gen types typescript --project-id YOUR_PROJECT_ID > database.types.ts
```

## Architecture & Technical Stack

### Core Technologies
- **Frontend**: Next.js 15.5.2 with App Router, React 19.1.0, TypeScript 5
- **UI Framework**: Tailwind CSS 4  
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Authentication**: LINE Login via LIFF SDK 2.27.2
- **OCR Processing**: Gemini AI for receipt processing

### High-Level Architecture

```
[LINE LIFF Client] 
    ↓ (OAuth2 Login)
[Next.js App Router] 
    ↓ (API Routes)
[Supabase Database + Storage]
    ↓ (Edge Functions)  
[OCR Service (Gemini AI)]
```

### Authentication Flow
1. User authenticates via LINE Login through LIFF
2. Client sends `idToken` to `/api/liff/login`
3. Server verifies token using LINE JWKS
4. Creates/updates user profile with internal UUID (primary key) mapped to `line_user_id`

### Data Architecture
The system uses Supabase with the following key tables:
- `user_profiles`: User data with UUID primary key, LINE mapping, role (contractor/homeowner)
- `receipts`: Receipt data with OCR results and approval status
- `receipt_images`: Stored receipt images with SHA256 hashing
- `rewards`: Reward catalog with points cost and availability
- `redemptions`: User reward redemptions with shipping status
- `point_transactions`: Points ledger for earning/spending/expiring

### Security Model
- **Server-side verification**: LINE idToken validation on every login
- **Row Level Security**: Supabase RLS policies restrict data access
- **Admin controls**: `is_admin` flag for administrative functions
- **Audit trail**: All receipt approvals and redemptions are logged

## Key File Structure

```
src/app/                    # Next.js App Router pages
src/app/api/               # API routes for authentication and data operations
  ├── liff/login           # LINE authentication endpoint
  ├── profile/update       # User profile management
  ├── receipts/upload      # Receipt upload and OCR trigger
  ├── rewards/redeem       # Reward redemption logic
  └── admin/              # Admin panel endpoints
docs/                      # Project documentation
  ├── architecture.md      # System architecture specification
  ├── prd/                # Product Requirements (sharded)
  └── stories/            # Development stories with detailed specs
database.types.ts          # Supabase TypeScript type definitions
```

## Development Context

### Documentation-Driven Development
This project follows a structured approach with:
- **PRD (Product Requirements)**: Sharded into functional sections in `docs/prd/`
- **Architecture Documentation**: Comprehensive system design in `docs/architecture.md` 
- **Story-Based Development**: Detailed implementation stories in `docs/stories/`
- **BMAD Framework**: Uses BMAD™ Core for project management and story creation

### Database Schema Management
- **Type Safety**: Use `database.types.ts` for all Supabase operations
- **Schema Updates**: Regenerate types when database schema changes
- **RLS Policies**: All sensitive tables have Row Level Security configured

### LINE Integration Requirements
- **LIFF SDK**: Already installed, requires channel configuration
- **Mobile-First**: UI designed for mobile LINE app usage
- **Token Verification**: Server-side LINE JWKS verification is mandatory

### OCR Workflow
1. Receipt uploaded to Supabase Storage
2. Triggers Edge Function for Gemini AI processing
3. OCR data stored in `receipts.ocr_data`
4. Admin reviews and approves/rejects for points award

## Environment Variables Needed
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Public Supabase key for client-side operations
- `SUPABASE_SERVICE_ROLE_KEY`: Server-side key for admin operations (never expose to client)
- `LINE_CHANNEL_ID`: LINE Login channel identifier
- `NEXT_PUBLIC_LINE_LIFF_ID`: LIFF app ID for client-side initialization
- เวลาพิมพ์ commit message ที่แก้ไปทั้งหมด ให้แค่ข้อความ ไม่ต้อง command line