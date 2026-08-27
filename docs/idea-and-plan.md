# Baby Day — Idea & Plan

**A shared, low-friction newborn care companion for parents working from home**

*Product idea, requirements, architecture, roadmap, and implementation plan*  
*Prepared: 27 August 2026*

## 1. Executive summary

Baby Day is a simple shared web/PWA designed for two parents caring for a newborn while balancing work, sleep, and household responsibilities.

The central idea is not to create another complicated baby tracker. It is to create a **shared memory and handover layer**: either parent can quickly record what happened, the information becomes available to the other parent, and the app turns the event stream into useful summaries.

The product should be:

- Local-first
- Mobile-first
- Fast enough to use one-handed during a feed
- Private
- Reliable offline
- Extensible through an event-based data model

The first production target is a private family app used by two parents on their phones, with optional desktop access for work-from-home use.

## 2. Problem

Newborn care produces many small events:

- Feeds
- Expressed milk
- Formula
- Diapers
- Sleep
- Weight
- Appointments
- Observations
- Other family-defined events

Parents frequently alternate responsibility. The biggest friction is often not recording information; it is knowing what the other parent already did.

Working from home adds context switching: a parent may be in a meeting, pumping, feeding, or trying to sleep and cannot reliably remember details later.

Existing baby trackers can be too detailed, too individual, or too cumbersome for a two-parent workflow.

Important information is often scattered across memory, messaging apps, paper notes, phone notes, and separate apps.

## 3. Product principles

1. **Shared by default** — both parents see the same source of truth.
2. **One-tap first** — common actions should take seconds, not require a form.
3. **Local-first** — saving an event should not depend on network availability.
4. **Safe synchronization** — offline events queue and synchronize later without silently losing data.
5. **Low cognitive load** — answer "what happened?" and "what needs attention?" rather than overwhelming parents with charts.
6. **Flexible data** — new event types and fields should be addable without redesigning the whole database.
7. **Private by design** — family data must be isolated using authentication and database access policies.
8. **Progressive complexity** — basic logging first; analytics, integrations, and automation later.

## 4. Core user experience

### 4.1 Home screen

The home screen should contain:

- Baby name and today's date
- Connection/sync status
- Large quick-log buttons:
  - Feed
  - Pump
  - Diaper
  - Sleep
  - Weight
  - Note
- Compact daily counters:
  - Feeds
  - Milk volume
  - Wet diapers
  - Sleep
- **Since your last visit** handover card
- Chronological timeline for today

### 4.2 Quick logging

The default interaction should be optimized for speed. A parent taps an action, enters only the information that matters, and saves. Optional fields should never block logging.

**Feed**
- Breast
- Expressed milk
- Formula
- Mixed
- Optional volume
- Optional duration
- Optional note

**Pumping**
- Volume
- Time

**Diaper**
- Wet
- Dirty
- Wet + dirty

**Sleep**
- Start
- End

**Weight**
- Weight
- Time

**Note**
- Free-text observation
- Time

### 4.3 Handover

The handover is the defining feature.

It should show:

- Last feed and method/volume
- Last diaper
- Most recent sleep period
- Events added since this parent's last visit
- Eventually, an optional "next likely task" based on configurable family routines

## 5. Data model

Use an **event-oriented model**. Each care action is an event with a stable ID, timestamp, parent attribution, type, and flexible JSON data.

Core entities:

- **Family** — shared household/team
- **Baby** — child profile belonging to a family
- **Family member** — authenticated parent/device identity and display name
- **Event** — id, family_id, baby_id, parent, type, time, created_at, data

Future entities/features can include:

- Attachments
- Reminders
- Appointments
- Measurements
- Custom event definitions

Example:

```text
{
  id,
  family_id,
  baby_id,
  parent,
  type: "feed",
  time,
  created_at,
  data: {
    method: "Expressed milk",
    ml: 60,
    min: 10,
    note: "Calm feed"
  }
}
```

## 6. Architecture

### Frontend

Start with responsive HTML/CSS/JavaScript. Move to a structured TypeScript application if the feature set grows.

### PWA

Provide:

- Installable mobile experience
- Standalone home-screen experience
- Service-worker caching
- Offline application shell

### Local storage

Persist events immediately on the device and maintain an outbound queue for events waiting to synchronize.

### Backend

Use Supabase/Postgres for shared family data.

### Authentication

An initial prototype may use anonymous sign-in. Production should move to recoverable parent authentication, such as email magic link or another supported identity provider.

### Authorization

Use Row Level Security (RLS) so a user can only read/write events belonging to a family they joined.

### Realtime

Subscribe to event changes so the second parent's device updates without manual refresh.

### Hosting

Use GitHub Pages or another static HTTPS host for the frontend. Supabase provides the backend.

## 7. Synchronization design

1. Parent taps **Save**.
2. Event is written to local storage immediately.
3. Event is added to the sync queue.
4. UI updates immediately.
5. If connected, the client upserts queued events to the backend.
6. Realtime delivers new/updated events to other family devices.
7. On reconnect, the client retries queued events.
8. Stable event IDs make retries idempotent.
9. Later versions should add explicit versioning/conflict handling for edits.

### Important production consideration

Anonymous authentication is convenient for a prototype but creates recovery limitations if browser storage is cleared or a device is replaced. Production should use recoverable accounts and a family invitation flow.

## 8. Privacy and security

- Only use the Supabase publishable browser key in the frontend.
- Never expose a Supabase secret/service key.
- Enable RLS on every family-owned table.
- Do not rely on an unguessable family code alone for authorization.
- Use HTTPS everywhere.
- Minimize stored personal information.
- Provide export and deletion capabilities.
- Document retention and backup behavior.
- Keep sensitive observations optional and avoid collecting unnecessary data.

## 9. MVP scope

The first useful release should be deliberately small.

- Two-parent family account/invitation
- One baby profile per family initially
- Feed, pump, diaper, sleep, weight, note
- Fast add/edit/delete
- Today timeline
- Daily summary
- Since-last-visit handover
- Offline queue
- Realtime synchronization
- Installable PWA
- Basic JSON/CSV export
- Clear sync status

## 10. Phase roadmap

### Phase 0 — Prototype foundation

- Static app shell
- Event-based local data model
- Quick logging
- Timeline and daily totals
- Backup/export

### Phase 1 — Shared family MVP

- Supabase schema
- Authentication
- Family creation/join
- RLS
- Realtime sync
- Offline queue
- PWA installation

### Phase 2 — Reliability

- Edit events
- Sync conflict strategy
- Better reconnect handling
- Automated backups/export
- Error reporting
- Account recovery

### Phase 3 — Useful intelligence

- Trends and charts
- Feed interval patterns
- Sleep summaries
- Weight trajectory
- Custom fields
- Configurable routines

### Phase 4 — Family operations

- Appointments
- Reminders
- Shared task list
- Care handover notes
- Calendar integration
- Optional notifications

### Phase 5 — Advanced ideas

- Cry/audio experiments as a separate opt-in feature
- Pattern detection
- Personalized summaries
- Multiple caregivers
- Pediatrician-friendly export

Medical guidance should remain informational. The app should not become an autonomous medical decision-maker.

## 11. What to measure

- Median time to log a common event
- Percentage of events successfully synchronized
- Offline queue recovery success rate
- Number of taps required for common actions
- Daily active use by each parent
- Percentage of days with complete handover information
- Edit/delete frequency
- Crash/error rate
- Sync failure rate

## 12. Critical product risks

### Too many fields

Logging becomes a chore.

**Mitigation:** defaults and optional details.

### False confidence from analytics

Trends can look authoritative even with missing data.

**Mitigation:** show data completeness and avoid medical conclusions.

### Sync conflicts

Edits made on two phones can diverge.

**Mitigation:** make event creation immutable initially; add explicit edit/version semantics later.

### Account recovery

Anonymous identity can be lost.

**Mitigation:** recoverable authentication before relying on the app for long-term history.

### Overbuilding

Newborn care is already exhausting.

**Mitigation:** prioritize handover and quick logging over feature count.

### Notification fatigue

Too many alerts become another burden.

**Mitigation:** quiet defaults and user-configurable notifications.

## 13. Suggested GitHub repository structure

```text
baby-day/
├── index.html
├── manifest.webmanifest
├── sw.js
├── schema.sql
├── README.md
├── src/                 # future structured frontend
├── docs/                # product and technical documentation
└── .github/workflows/   # automated deployment
```

## 14. Definition of done for the first real family release

- Both parents can open the app on their phones.
- Both can sign in and recover their identity.
- One parent can create a family and invite the other.
- Both see the same baby and event timeline.
- An event appears locally immediately.
- An event entered on one phone appears on the other without refresh when online.
- An event entered offline eventually synchronizes.
- Editing/deleting an event behaves predictably.
- Data from another family cannot be accessed.
- The app can be installed from the mobile browser.
- A backup/export can be produced.
- The README explains setup, security, and recovery.

## 15. Immediate implementation plan

1. Finalize the repository and keep the current prototype as the baseline.
2. Set up Supabase and run the database schema.
3. Replace anonymous-only access with recoverable parent authentication.
4. Implement family creation and invitation.
5. Connect the local queue to Postgres with idempotent upserts.
6. Add realtime subscriptions.
7. Test two phones concurrently:
   - Online
   - Offline
   - Reconnect
   - Edit
   - Delete
   - Reload
8. Deploy the PWA over HTTPS.
9. Install it on both parents' phones.
10. Use it for a week before adding more features and record actual friction points.

## 16. Product vision

Baby Day should feel less like a database and more like a **shared memory for the family**.

The winning experience is:

> One parent logs something in a few seconds, the other parent immediately knows, and neither has to ask, "Did the baby already feed?" or "When was the last diaper?"

The long-term differentiator is not the number of tracked metrics. It is the quality of the **shared handover**:

- Clear
- Trustworthy
- Private
- Effortless
- Useful during the most sleep-deprived period of early parenthood
