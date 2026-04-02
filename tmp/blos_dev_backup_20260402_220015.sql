--
-- PostgreSQL database dump
--

\restrict U0cwySsE47f50WLVTqr355XHvrZsmLC2IP35gc5na3Go3tQgK1YEQ1jjw73fCM7

-- Dumped from database version 16.13 (Homebrew)
-- Dumped by pg_dump version 16.13 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ActivityAction; Type: TYPE; Schema: public; Owner: karol
--

CREATE TYPE public."ActivityAction" AS ENUM (
    'CREATED',
    'UPDATED',
    'DELETED',
    'COMMENTED',
    'STATUS_CHANGED',
    'ASSIGNED'
);


ALTER TYPE public."ActivityAction" OWNER TO karol;

--
-- Name: AiJobStatus; Type: TYPE; Schema: public; Owner: karol
--

CREATE TYPE public."AiJobStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'DONE',
    'FAILED'
);


ALTER TYPE public."AiJobStatus" OWNER TO karol;

--
-- Name: AiJobType; Type: TYPE; Schema: public; Owner: karol
--

CREATE TYPE public."AiJobType" AS ENUM (
    'TRANSCRIPTION',
    'TASK_EXTRACTION'
);


ALTER TYPE public."AiJobType" OWNER TO karol;

--
-- Name: EntityType; Type: TYPE; Schema: public; Owner: karol
--

CREATE TYPE public."EntityType" AS ENUM (
    'TASK',
    'NOTE',
    'PROJECT',
    'PERSON',
    'VOICE_NOTE',
    'FILE',
    'MESSAGE',
    'EVENT'
);


ALTER TYPE public."EntityType" OWNER TO karol;

--
-- Name: IntegrationType; Type: TYPE; Schema: public; Owner: karol
--

CREATE TYPE public."IntegrationType" AS ENUM (
    'TELEGRAM',
    'WHATSAPP',
    'APPLE_CALENDAR'
);


ALTER TYPE public."IntegrationType" OWNER TO karol;

--
-- Name: MessageChannel; Type: TYPE; Schema: public; Owner: karol
--

CREATE TYPE public."MessageChannel" AS ENUM (
    'TELEGRAM',
    'WHATSAPP'
);


ALTER TYPE public."MessageChannel" OWNER TO karol;

--
-- Name: MessageDirection; Type: TYPE; Schema: public; Owner: karol
--

CREATE TYPE public."MessageDirection" AS ENUM (
    'INBOUND',
    'OUTBOUND'
);


ALTER TYPE public."MessageDirection" OWNER TO karol;

--
-- Name: MessageStatus; Type: TYPE; Schema: public; Owner: karol
--

CREATE TYPE public."MessageStatus" AS ENUM (
    'SENT',
    'DELIVERED',
    'READ',
    'FAILED'
);


ALTER TYPE public."MessageStatus" OWNER TO karol;

--
-- Name: NoteType; Type: TYPE; Schema: public; Owner: karol
--

CREATE TYPE public."NoteType" AS ENUM (
    'QUICK',
    'MEETING',
    'VOICE'
);


ALTER TYPE public."NoteType" OWNER TO karol;

--
-- Name: ProjectStatus; Type: TYPE; Schema: public; Owner: karol
--

CREATE TYPE public."ProjectStatus" AS ENUM (
    'ACTIVE',
    'PAUSED',
    'DONE',
    'ARCHIVED'
);


ALTER TYPE public."ProjectStatus" OWNER TO karol;

--
-- Name: TaskPriority; Type: TYPE; Schema: public; Owner: karol
--

CREATE TYPE public."TaskPriority" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


ALTER TYPE public."TaskPriority" OWNER TO karol;

--
-- Name: TaskStatus; Type: TYPE; Schema: public; Owner: karol
--

CREATE TYPE public."TaskStatus" AS ENUM (
    'TODO',
    'IN_PROGRESS',
    'WAITING',
    'DONE'
);


ALTER TYPE public."TaskStatus" OWNER TO karol;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: karol
--

CREATE TYPE public."UserRole" AS ENUM (
    'OWNER',
    'MEMBER'
);


ALTER TYPE public."UserRole" OWNER TO karol;

--
-- Name: VoiceNoteStatus; Type: TYPE; Schema: public; Owner: karol
--

CREATE TYPE public."VoiceNoteStatus" AS ENUM (
    'UPLOADED',
    'TRANSCRIBING',
    'DONE',
    'FAILED'
);


ALTER TYPE public."VoiceNoteStatus" OWNER TO karol;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text
);


ALTER TABLE public."Account" OWNER TO karol;

--
-- Name: Activity; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."Activity" (
    id text NOT NULL,
    action public."ActivityAction" NOT NULL,
    "entityType" public."EntityType" NOT NULL,
    "entityId" text NOT NULL,
    "userId" text NOT NULL,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Activity" OWNER TO karol;

--
-- Name: AiJob; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."AiJob" (
    id text NOT NULL,
    type public."AiJobType" NOT NULL,
    status public."AiJobStatus" DEFAULT 'PENDING'::public."AiJobStatus" NOT NULL,
    input jsonb NOT NULL,
    output jsonb,
    error text,
    "entityType" public."EntityType" NOT NULL,
    "entityId" text NOT NULL,
    "approvedAt" timestamp(3) without time zone,
    "approvedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."AiJob" OWNER TO karol;

--
-- Name: Comment; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."Comment" (
    id text NOT NULL,
    content text NOT NULL,
    "authorId" text NOT NULL,
    "taskId" text,
    "noteId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Comment" OWNER TO karol;

--
-- Name: Event; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."Event" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    "startAt" timestamp(3) without time zone NOT NULL,
    "endAt" timestamp(3) without time zone,
    "allDay" boolean DEFAULT false NOT NULL,
    location text,
    "workspaceId" text NOT NULL,
    "creatorId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Event" OWNER TO karol;

--
-- Name: File; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."File" (
    id text NOT NULL,
    name text NOT NULL,
    url text NOT NULL,
    size integer NOT NULL,
    "mimeType" text NOT NULL,
    "taskId" text,
    "noteId" text,
    "workspaceId" text NOT NULL,
    "uploadedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."File" OWNER TO karol;

--
-- Name: Integration; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."Integration" (
    id text NOT NULL,
    type public."IntegrationType" NOT NULL,
    config jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "workspaceId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Integration" OWNER TO karol;

--
-- Name: Message; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."Message" (
    id text NOT NULL,
    direction public."MessageDirection" NOT NULL,
    channel public."MessageChannel" NOT NULL,
    "externalId" text,
    content text,
    "mediaUrl" text,
    status public."MessageStatus" DEFAULT 'SENT'::public."MessageStatus" NOT NULL,
    "rawPayload" jsonb,
    "personId" text,
    "workspaceId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Message" OWNER TO karol;

--
-- Name: Note; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."Note" (
    id text NOT NULL,
    title text,
    content text DEFAULT ''::text NOT NULL,
    type public."NoteType" DEFAULT 'QUICK'::public."NoteType" NOT NULL,
    "projectId" text,
    "workspaceId" text NOT NULL,
    "authorId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Note" OWNER TO karol;

--
-- Name: Notification; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    read boolean DEFAULT false NOT NULL,
    "linkUrl" text,
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Notification" OWNER TO karol;

--
-- Name: Person; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."Person" (
    id text NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    "telegramId" text,
    "whatsappId" text,
    company text,
    notes text,
    "workspaceId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Person" OWNER TO karol;

--
-- Name: Project; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."Project" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    status public."ProjectStatus" DEFAULT 'ACTIVE'::public."ProjectStatus" NOT NULL,
    "workspaceId" text NOT NULL,
    "ownerId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Project" OWNER TO karol;

--
-- Name: Session; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "sessionToken" text NOT NULL,
    "userId" text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Session" OWNER TO karol;

--
-- Name: Task; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."Task" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    status public."TaskStatus" DEFAULT 'TODO'::public."TaskStatus" NOT NULL,
    priority public."TaskPriority" DEFAULT 'MEDIUM'::public."TaskPriority" NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "calendarEventId" text,
    "projectId" text NOT NULL,
    "assigneeId" text,
    "creatorId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "sourceMessageId" text
);


ALTER TABLE public."Task" OWNER TO karol;

--
-- Name: User; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    name text,
    "avatarUrl" text,
    "emailVerified" timestamp(3) without time zone,
    role public."UserRole" DEFAULT 'MEMBER'::public."UserRole" NOT NULL,
    "workspaceId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."User" OWNER TO karol;

--
-- Name: VerificationToken; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."VerificationToken" (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."VerificationToken" OWNER TO karol;

--
-- Name: VoiceNote; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."VoiceNote" (
    id text NOT NULL,
    "noteId" text NOT NULL,
    "audioUrl" text NOT NULL,
    duration integer NOT NULL,
    transcription text,
    status public."VoiceNoteStatus" DEFAULT 'UPLOADED'::public."VoiceNoteStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."VoiceNote" OWNER TO karol;

--
-- Name: Workspace; Type: TABLE; Schema: public; Owner: karol
--

CREATE TABLE public."Workspace" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    "ownerId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Workspace" OWNER TO karol;

--
-- Data for Name: Account; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."Account" (id, "userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state) FROM stdin;
\.


--
-- Data for Name: Activity; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."Activity" (id, action, "entityType", "entityId", "userId", metadata, "createdAt") FROM stdin;
cmnehn0v50003p0bsoed8zw9g	CREATED	NOTE	cmnehn0up0001p0bs9muqx2b7	cmneh00vq0000p03ab43fcqba	\N	2026-03-31 10:42:37.986
cmnei9yxc0005p0bskqnye10u	STATUS_CHANGED	TASK	cmneh00we000ap03ayfuh16bp	cmneh00vq0000p03ab43fcqba	{"to": "DONE"}	2026-03-31 11:00:28.556
cmnemi9rd0009p0bsc0c0wsod	CREATED	TASK	cmnemi9ql0007p0bsjk9uxws1	cmneh00vq0000p03ab43fcqba	\N	2026-03-31 12:58:54.313
cmnemiqdq000bp0bs81tffz8o	STATUS_CHANGED	TASK	cmnemi9ql0007p0bsjk9uxws1	cmneh00vq0000p03ab43fcqba	{"to": "DONE"}	2026-03-31 12:59:15.854
cmnenmt3f000dp0bs6x0xvttv	STATUS_CHANGED	TASK	cmneh00wc0006p03a2cqd19hy	cmneh00vq0000p03ab43fcqba	{"to": "DONE"}	2026-03-31 13:30:25.611
cmnenmtp4000fp0bs8dumpkch	STATUS_CHANGED	TASK	cmneh00wd0008p03abcfenum5	cmneh00vq0000p03ab43fcqba	{"to": "DONE"}	2026-03-31 13:30:26.392
cmnenmuc1000hp0bsxvlfbr3i	STATUS_CHANGED	TASK	cmneh00wf000cp03a8br5voyf	cmneh00vq0000p03ab43fcqba	{"to": "DONE"}	2026-03-31 13:30:27.217
cmnenn9uh000lp0bs0hbo9y30	CREATED	PROJECT	cmnenn9uc000jp0bsim3cany1	cmneh00vq0000p03ab43fcqba	\N	2026-03-31 13:30:47.321
cmnennrrk000pp0bsm150cx2b	CREATED	TASK	cmnennrrh000np0bsknzlxv9a	cmneh00vq0000p03ab43fcqba	\N	2026-03-31 13:31:10.545
cmnetcgb0000rp0bsu711sjrm	STATUS_CHANGED	TASK	cmnennrrh000np0bsknzlxv9a	cmneh00vq0000p03ab43fcqba	{"to": "IN_PROGRESS", "from": "TODO"}	2026-03-31 16:10:20.172
cmnetlh7e000vp0bslxaj1rdg	COMMENTED	TASK	cmnennrrh000np0bsknzlxv9a	cmneh00vq0000p03ab43fcqba	\N	2026-03-31 16:17:21.242
cmneumw4u000zp0bsllfcszey	ASSIGNED	TASK	cmnennrrh000np0bsknzlxv9a	cmneh00vq0000p03ab43fcqba	{"assigneeId": "cmneh00vq0000p03ab43fcqba"}	2026-03-31 16:46:26.862
cmnf3hktm0015p0bs4gict9xo	CREATED	TASK	cmnf3hkmy0013p0bsuyls1q2x	cmneh00vq0000p03ab43fcqba	{"source": "message", "messageId": "seed-msg-5"}	2026-03-31 20:54:15.466
cmnf4hiij0019p0bskmwkxnpq	ASSIGNED	TASK	cmnf3hkmy0013p0bsuyls1q2x	cmneh00vq0000p03ab43fcqba	{"assigneeId": "cmneh00vq0000p03ab43fcqba"}	2026-03-31 21:22:12.091
cmnf4i7kr001dp0bscx9lx0xb	STATUS_CHANGED	TASK	cmnf3hkmy0013p0bsuyls1q2x	cmneh00vq0000p03ab43fcqba	{"to": "IN_PROGRESS", "from": "TODO"}	2026-03-31 21:22:44.571
cmnf4ix4g001fp0bs9es133gu	UPDATED	TASK	cmnf3hkmy0013p0bsuyls1q2x	cmneh00vq0000p03ab43fcqba	\N	2026-03-31 21:23:17.681
cmnf4jwxa001jp0bsvtb88ucs	COMMENTED	TASK	cmnf3hkmy0013p0bsuyls1q2x	cmneh00vq0000p03ab43fcqba	\N	2026-03-31 21:24:04.078
cmnfziwax0003p08z31gfivfu	CREATED	TASK	cmnfziw630001p08zpuv98441	cmneh00vq0000p03ab43fcqba	{"source": "message", "messageId": "seed-msg-5"}	2026-04-01 11:51:04.713
cmnfzkm4z0007p08z79kwuwkf	STATUS_CHANGED	TASK	cmnfziw630001p08zpuv98441	cmneh00vq0000p03ab43fcqba	{"to": "IN_PROGRESS", "from": "TODO"}	2026-04-01 11:52:24.851
cmnfzl8960009p08zfi2w3eir	ASSIGNED	TASK	cmnfziw630001p08zpuv98441	cmneh00vq0000p03ab43fcqba	{"assigneeId": "cmneh00vq0000p03ab43fcqba"}	2026-04-01 11:52:53.514
cmnfzm3bm000fp08zc0l7bkar	COMMENTED	TASK	cmnfziw630001p08zpuv98441	cmneh00vq0000p03ab43fcqba	\N	2026-04-01 11:53:33.779
cmng251wm000lp08z45f3olw8	CREATED	PERSON	cmng251w8000jp08zdsi5c8t5	cmneh00vq0000p03ab43fcqba	\N	2026-04-01 13:04:17.638
cmng8het7000pp08z6sqz19kg	CREATED	NOTE	cmng8hesn000np08zz6n0aur7	cmneh00vq0000p03ab43fcqba	\N	2026-04-01 16:01:51.931
cmng8iq3e000rp08z1kibs9v1	UPDATED	NOTE	cmng8hesn000np08zz6n0aur7	cmneh00vq0000p03ab43fcqba	\N	2026-04-01 16:02:53.21
cmng9aqvi000tp08zrxwmcvx9	DELETED	NOTE	cmng8hesn000np08zz6n0aur7	cmneh00vq0000p03ab43fcqba	\N	2026-04-01 16:24:40.59
cmnh4beto000vp08z9wztjxzh	UPDATED	TASK	cmnfwk5ps001tp0bsfhyukftt	cmneh00vq0000p03ab43fcqba	\N	2026-04-02 06:52:59.722
cmnh4bfle000xp08zunijomiw	UPDATED	TASK	cmnfwk5ps001tp0bsfhyukftt	cmneh00vq0000p03ab43fcqba	\N	2026-04-02 06:53:00.722
cmnh4bjb7000zp08z9gyzjfla	ASSIGNED	TASK	cmnfwk5ps001tp0bsfhyukftt	cmneh00vq0000p03ab43fcqba	{"assigneeId": "cmneh00vq0000p03ab43fcqba"}	2026-04-02 06:53:05.539
cmnh4bn0z0013p08zwazj24rd	UPDATED	TASK	cmnfwk5ps001tp0bsfhyukftt	cmneh00vq0000p03ab43fcqba	\N	2026-04-02 06:53:10.355
cmnh4cv5p0017p08zlvfgbnpx	CREATED	NOTE	cmnh4cv5h0015p08zrlhyx9bc	cmneh00vq0000p03ab43fcqba	\N	2026-04-02 06:54:07.55
cmnh7tczw0003p0btwa69ifmr	CREATED	EVENT	cmnh7tczc0001p0btqrekp7cs	cmneh00vq0000p03ab43fcqba	\N	2026-04-02 08:30:56.012
cmnh7vhfq0007p0btpn9ezcxr	CREATED	EVENT	cmnh7vhfb0005p0btzkdln20e	cmneh00vq0000p03ab43fcqba	\N	2026-04-02 08:32:35.078
\.


--
-- Data for Name: AiJob; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."AiJob" (id, type, status, input, output, error, "entityType", "entityId", "approvedAt", "approvedById", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Comment; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."Comment" (id, content, "authorId", "taskId", "noteId", "createdAt", "updatedAt") FROM stdin;
cmnetlh6h000tp0bs3z3a7b5b	Test comment for validation	cmneh00vq0000p03ab43fcqba	cmnennrrh000np0bsknzlxv9a	\N	2026-03-31 16:17:21.209	2026-03-31 16:17:21.209
cmnf4jwx5001hp0bs7pk16j43	Will prepare and send the invoice by EOD tomorrow.	cmneh00vq0000p03ab43fcqba	cmnf3hkmy0013p0bsuyls1q2x	\N	2026-03-31 21:24:04.073	2026-03-31 21:24:04.073
cmnfzm3av000dp08z0lqnxork	Need to check the contract details before sending the invoice.	cmneh00vq0000p03ab43fcqba	cmnfziw630001p08zpuv98441	\N	2026-04-01 11:53:33.751	2026-04-01 11:53:33.751
\.


--
-- Data for Name: Event; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."Event" (id, title, description, "startAt", "endAt", "allDay", location, "workspaceId", "creatorId", "createdAt", "updatedAt") FROM stdin;
cmnh7tczc0001p0btqrekp7cs	QA Test Meeting	\N	2026-04-02 07:00:00	2026-04-02 08:00:00	f	Office	cmneh00vz0002p03aaxux3752	cmneh00vq0000p03ab43fcqba	2026-04-02 08:30:55.992	2026-04-02 08:30:55.992
cmnh7vhfb0005p0btzkdln20e	Future Test Event	\N	2026-04-03 12:00:00	2026-04-03 13:00:00	f	\N	cmneh00vz0002p03aaxux3752	cmneh00vq0000p03ab43fcqba	2026-04-02 08:32:35.062	2026-04-02 08:32:35.062
\.


--
-- Data for Name: File; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."File" (id, name, url, size, "mimeType", "taskId", "noteId", "workspaceId", "uploadedById", "createdAt") FROM stdin;
\.


--
-- Data for Name: Integration; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."Integration" (id, type, config, enabled, "workspaceId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Message; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."Message" (id, direction, channel, "externalId", content, "mediaUrl", status, "rawPayload", "personId", "workspaceId", "createdAt", "updatedAt") FROM stdin;
seed-msg-1	INBOUND	TELEGRAM	\N	Hi Karol, I wanted to discuss the new product launch timeline. Can we move the deadline to next Friday?	\N	DELIVERED	\N	seed-person-1	cmneh00vz0002p03aaxux3752	2026-03-31 15:55:20.332	2026-03-31 19:55:20.49
seed-msg-2	OUTBOUND	TELEGRAM	\N	Hey John, let me check with the team and get back to you today.	\N	SENT	\N	seed-person-1	cmneh00vz0002p03aaxux3752	2026-03-31 16:25:20.332	2026-03-31 19:55:20.509
seed-msg-3	INBOUND	TELEGRAM	\N	Thanks! Also, we need the updated contract for Acme Corp signed by end of week. Can you handle that?	\N	DELIVERED	\N	seed-person-1	cmneh00vz0002p03aaxux3752	2026-03-31 16:55:20.332	2026-03-31 19:55:20.519
seed-msg-4	OUTBOUND	TELEGRAM	\N	Sure, I'll create a task for the contract. The deadline extension should be fine — I'll confirm by EOD.	\N	SENT	\N	seed-person-1	cmneh00vz0002p03aaxux3752	2026-03-31 17:25:20.332	2026-03-31 19:55:20.557
seed-msg-5	INBOUND	TELEGRAM	\N	Perfect. One more thing — please send me the invoice for last month's consulting work.	\N	DELIVERED	\N	seed-person-1	cmneh00vz0002p03aaxux3752	2026-03-31 18:55:20.332	2026-03-31 19:55:20.566
\.


--
-- Data for Name: Note; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."Note" (id, title, content, type, "projectId", "workspaceId", "authorId", "createdAt", "updatedAt") FROM stdin;
cmnehn0up0001p0bs9muqx2b7	Projekt farmy 1		QUICK	\N	cmneh00vz0002p03aaxux3752	cmneh00vq0000p03ab43fcqba	2026-03-31 10:42:37.969	2026-03-31 10:42:37.969
cmnh4cv5h0015p08zrlhyx9bc	JKBLDvdlibaebbcoa		QUICK	\N	cmneh00vz0002p03aaxux3752	cmneh00vq0000p03ab43fcqba	2026-04-02 06:54:07.541	2026-04-02 06:54:07.541
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."Notification" (id, type, title, body, read, "linkUrl", "userId", "createdAt") FROM stdin;
cmnetlh7i000xp0bsrvu50hjl	COMMENT_ADDED	New comment	Comment added on task	f	/tasks/cmnennrrh000np0bsknzlxv9a	cmneh00vq0000p03ab43fcqba	2026-03-31 16:17:21.246
cmneumw7o0011p0bsyeqjrs7u	TASK_ASSIGNED	Task assigned	"nmg kj" was assigned	f	/tasks/cmnennrrh000np0bsknzlxv9a	cmneh00vq0000p03ab43fcqba	2026-03-31 16:46:26.964
cmnf3hktt0017p0bs3zh9unxs	TASK_FROM_MESSAGE	Task created from message	"Send invoice to John Client" created from conversation	f	/tasks	cmneh00vq0000p03ab43fcqba	2026-03-31 20:54:15.473
cmnf4hila001bp0bs8fggkl79	TASK_ASSIGNED	Task assigned	"Send invoice to John Client" was assigned	f	/tasks/cmnf3hkmy0013p0bsuyls1q2x	cmneh00vq0000p03ab43fcqba	2026-03-31 21:22:12.19
cmnf4jwxb001lp0bswuk2uq8q	COMMENT_ADDED	New comment	Comment added on task	f	/tasks/cmnf3hkmy0013p0bsuyls1q2x	cmneh00vq0000p03ab43fcqba	2026-03-31 21:24:04.08
cmnfziwb00005p08z92e9ts4u	TASK_FROM_MESSAGE	Task created from message	"Send invoice for consulting work" created from conversation	f	/tasks	cmneh00vq0000p03ab43fcqba	2026-04-01 11:51:04.717
cmnfzl89a000bp08zuz7g6hc9	TASK_ASSIGNED	Task assigned	"Send invoice for consulting work" was assigned	f	/tasks/cmnfziw630001p08zpuv98441	cmneh00vq0000p03ab43fcqba	2026-04-01 11:52:53.518
cmnfzm3bo000hp08z60ep409v	COMMENT_ADDED	New comment	Comment added on task	f	/tasks/cmnfziw630001p08zpuv98441	cmneh00vq0000p03ab43fcqba	2026-04-01 11:53:33.78
cmnh4bjbc0011p08zfbsgsigh	TASK_ASSIGNED	Task assigned	"Debug test task" was assigned	f	/tasks/cmnfwk5ps001tp0bsfhyukftt	cmneh00vq0000p03ab43fcqba	2026-04-02 06:53:05.544
\.


--
-- Data for Name: Person; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."Person" (id, name, email, phone, "telegramId", "whatsappId", company, notes, "workspaceId", "createdAt", "updatedAt") FROM stdin;
seed-person-1	John Client	john@example.com	\N	123456789	\N	Acme Corp	\N	cmneh00vz0002p03aaxux3752	2026-03-31 10:24:44.944	2026-03-31 19:55:20.335
cmng251w8000jp08zdsi5c8t5	Maria Test	maria@test.com	\N	\N	\N	Test Corp	\N	cmneh00vz0002p03aaxux3752	2026-04-01 13:04:17.624	2026-04-01 13:04:17.624
\.


--
-- Data for Name: Project; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."Project" (id, name, description, status, "workspaceId", "ownerId", "createdAt", "updatedAt") FROM stdin;
seed-project-1	Business Life OS	Building the command center	ACTIVE	cmneh00vz0002p03aaxux3752	cmneh00vq0000p03ab43fcqba	2026-03-31 10:24:44.933	2026-03-31 10:24:44.933
cmnenn9uc000jp0bsim3cany1	Farma Foto z Anką	\N	ACTIVE	cmneh00vz0002p03aaxux3752	cmneh00vq0000p03ab43fcqba	2026-03-31 13:30:47.316	2026-03-31 13:30:47.316
\.


--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."Session" (id, "sessionToken", "userId", expires) FROM stdin;
\.


--
-- Data for Name: Task; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."Task" (id, title, description, status, priority, "dueDate", "calendarEventId", "projectId", "assigneeId", "creatorId", "createdAt", "updatedAt", "sourceMessageId") FROM stdin;
cmneh00w90004p03awyatdutj	Set up auth system	\N	DONE	HIGH	\N	\N	seed-project-1	cmneh00vq0000p03ab43fcqba	cmneh00vq0000p03ab43fcqba	2026-03-31 10:24:44.937	2026-03-31 10:24:44.937	\N
cmneh00we000ap03ayfuh16bp	Connect Telegram bot	\N	DONE	MEDIUM	\N	\N	seed-project-1	cmneh00vq0000p03ab43fcqba	cmneh00vq0000p03ab43fcqba	2026-03-31 10:24:44.943	2026-03-31 11:00:28.51	\N
cmnemi9ql0007p0bsjk9uxws1	Test after cuid fix	\N	DONE	MEDIUM	\N	\N	seed-project-1	\N	cmneh00vq0000p03ab43fcqba	2026-03-31 12:58:54.284	2026-03-31 12:59:15.841	\N
cmneh00wc0006p03a2cqd19hy	Build task management	\N	DONE	HIGH	\N	\N	seed-project-1	cmneh00vq0000p03ab43fcqba	cmneh00vq0000p03ab43fcqba	2026-03-31 10:24:44.94	2026-03-31 13:30:25.601	\N
cmneh00wd0008p03abcfenum5	Design mobile navigation	\N	DONE	MEDIUM	\N	\N	seed-project-1	cmneh00vq0000p03ab43fcqba	cmneh00vq0000p03ab43fcqba	2026-03-31 10:24:44.942	2026-03-31 13:30:26.387	\N
cmneh00wf000cp03a8br5voyf	Add voice recording	\N	DONE	LOW	\N	\N	seed-project-1	cmneh00vq0000p03ab43fcqba	cmneh00vq0000p03ab43fcqba	2026-03-31 10:24:44.943	2026-03-31 13:30:27.215	\N
cmnennrrh000np0bsknzlxv9a	nmg kj	\N	IN_PROGRESS	MEDIUM	\N	\N	cmnenn9uc000jp0bsim3cany1	cmneh00vq0000p03ab43fcqba	cmneh00vq0000p03ab43fcqba	2026-03-31 13:31:10.541	2026-03-31 16:46:26.795	\N
cmnf3hkmy0013p0bsuyls1q2x	Send invoice to John Client	Perfect. One more thing — please send me the invoice for last month's consulting work.	IN_PROGRESS	MEDIUM	\N	\N	seed-project-1	cmneh00vq0000p03ab43fcqba	cmneh00vq0000p03ab43fcqba	2026-03-31 20:54:15.225	2026-03-31 21:23:17.658	seed-msg-5
cmnfd9se1001np0bsomwvneww	Follow up on consulting invoice	Perfect. One more thing — please send me the invoice for last month's consulting work.	TODO	MEDIUM	\N	\N	seed-project-1	\N	cmneh00vq0000p03ab43fcqba	2026-04-01 01:28:08.185	2026-04-01 01:28:08.185	\N
cmnfwi6vu001pp0bs885o8c0b	Send invoice for last month consulting work	Perfect. One more thing — please send me the invoice for last month's consulting work.	TODO	MEDIUM	\N	\N	seed-project-1	\N	cmneh00vq0000p03ab43fcqba	2026-04-01 10:26:32.92	2026-04-01 10:26:32.92	\N
cmnfwioxk001rp0bscki7tb18	Send invoice for last month consulting work	Perfect. One more thing — please send me the invoice for last month's consulting work.	TODO	MEDIUM	\N	\N	seed-project-1	\N	cmneh00vq0000p03ab43fcqba	2026-04-01 10:26:56.313	2026-04-01 10:26:56.313	\N
cmnfziw630001p08zpuv98441	Send invoice for consulting work	Perfect. One more thing — please send me the invoice for last month's consulting work.	IN_PROGRESS	MEDIUM	\N	\N	seed-project-1	cmneh00vq0000p03ab43fcqba	cmneh00vq0000p03ab43fcqba	2026-04-01 11:51:04.539	2026-04-01 11:52:53.508	seed-msg-5
cmnfwk5ps001tp0bsfhyukftt	Debug test task	Testing clean Prisma flow	TODO	HIGH	2026-04-04 00:00:00	\N	cmnenn9uc000jp0bsim3cany1	cmneh00vq0000p03ab43fcqba	cmneh00vq0000p03ab43fcqba	2026-04-01 10:28:04.721	2026-04-02 06:53:10.353	\N
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."User" (id, email, name, "avatarUrl", "emailVerified", role, "workspaceId", "createdAt", "updatedAt") FROM stdin;
cmneh00vq0000p03ab43fcqba	karol@businesslifeos.com	Karol	\N	2026-03-31 10:24:44.533	OWNER	cmneh00vz0002p03aaxux3752	2026-03-31 10:24:44.918	2026-03-31 10:24:44.932
\.


--
-- Data for Name: VerificationToken; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."VerificationToken" (identifier, token, expires) FROM stdin;
\.


--
-- Data for Name: VoiceNote; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."VoiceNote" (id, "noteId", "audioUrl", duration, transcription, status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Workspace; Type: TABLE DATA; Schema: public; Owner: karol
--

COPY public."Workspace" (id, name, slug, "ownerId", "createdAt", "updatedAt") FROM stdin;
cmneh00vz0002p03aaxux3752	Karol's Workspace	karol-workspace	cmneh00vq0000p03ab43fcqba	2026-03-31 10:24:44.927	2026-03-31 10:24:44.927
\.


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: Activity Activity_pkey; Type: CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Activity"
    ADD CONSTRAINT "Activity_pkey" PRIMARY KEY (id);


--
-- Name: AiJob AiJob_pkey; Type: CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."AiJob"
    ADD CONSTRAINT "AiJob_pkey" PRIMARY KEY (id);


--
-- Name: Comment Comment_pkey; Type: CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_pkey" PRIMARY KEY (id);


--
-- Name: Event Event_pkey; Type: CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_pkey" PRIMARY KEY (id);


--
-- Name: File File_pkey; Type: CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."File"
    ADD CONSTRAINT "File_pkey" PRIMARY KEY (id);


--
-- Name: Integration Integration_pkey; Type: CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Integration"
    ADD CONSTRAINT "Integration_pkey" PRIMARY KEY (id);


--
-- Name: Message Message_pkey; Type: CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_pkey" PRIMARY KEY (id);


--
-- Name: Note Note_pkey; Type: CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Note"
    ADD CONSTRAINT "Note_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: Person Person_pkey; Type: CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Person"
    ADD CONSTRAINT "Person_pkey" PRIMARY KEY (id);


--
-- Name: Project Project_pkey; Type: CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: Task Task_pkey; Type: CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: VoiceNote VoiceNote_pkey; Type: CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."VoiceNote"
    ADD CONSTRAINT "VoiceNote_pkey" PRIMARY KEY (id);


--
-- Name: Workspace Workspace_pkey; Type: CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Workspace"
    ADD CONSTRAINT "Workspace_pkey" PRIMARY KEY (id);


--
-- Name: Account_provider_providerAccountId_key; Type: INDEX; Schema: public; Owner: karol
--

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON public."Account" USING btree (provider, "providerAccountId");


--
-- Name: Activity_createdAt_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Activity_createdAt_idx" ON public."Activity" USING btree ("createdAt");


--
-- Name: Activity_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Activity_entityType_entityId_idx" ON public."Activity" USING btree ("entityType", "entityId");


--
-- Name: Activity_userId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Activity_userId_idx" ON public."Activity" USING btree ("userId");


--
-- Name: AiJob_entityType_entityId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "AiJob_entityType_entityId_idx" ON public."AiJob" USING btree ("entityType", "entityId");


--
-- Name: AiJob_status_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "AiJob_status_idx" ON public."AiJob" USING btree (status);


--
-- Name: Comment_noteId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Comment_noteId_idx" ON public."Comment" USING btree ("noteId");


--
-- Name: Comment_taskId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Comment_taskId_idx" ON public."Comment" USING btree ("taskId");


--
-- Name: Event_creatorId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Event_creatorId_idx" ON public."Event" USING btree ("creatorId");


--
-- Name: Event_workspaceId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Event_workspaceId_idx" ON public."Event" USING btree ("workspaceId");


--
-- Name: Event_workspaceId_startAt_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Event_workspaceId_startAt_idx" ON public."Event" USING btree ("workspaceId", "startAt");


--
-- Name: File_noteId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "File_noteId_idx" ON public."File" USING btree ("noteId");


--
-- Name: File_taskId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "File_taskId_idx" ON public."File" USING btree ("taskId");


--
-- Name: File_workspaceId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "File_workspaceId_idx" ON public."File" USING btree ("workspaceId");


--
-- Name: Integration_workspaceId_type_key; Type: INDEX; Schema: public; Owner: karol
--

CREATE UNIQUE INDEX "Integration_workspaceId_type_key" ON public."Integration" USING btree ("workspaceId", type);


--
-- Name: Message_channel_externalId_key; Type: INDEX; Schema: public; Owner: karol
--

CREATE UNIQUE INDEX "Message_channel_externalId_key" ON public."Message" USING btree (channel, "externalId");


--
-- Name: Message_createdAt_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Message_createdAt_idx" ON public."Message" USING btree ("createdAt");


--
-- Name: Message_personId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Message_personId_idx" ON public."Message" USING btree ("personId");


--
-- Name: Message_workspaceId_channel_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Message_workspaceId_channel_idx" ON public."Message" USING btree ("workspaceId", channel);


--
-- Name: Note_authorId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Note_authorId_idx" ON public."Note" USING btree ("authorId");


--
-- Name: Note_projectId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Note_projectId_idx" ON public."Note" USING btree ("projectId");


--
-- Name: Note_workspaceId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Note_workspaceId_idx" ON public."Note" USING btree ("workspaceId");


--
-- Name: Notification_createdAt_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Notification_createdAt_idx" ON public."Notification" USING btree ("createdAt");


--
-- Name: Notification_userId_read_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Notification_userId_read_idx" ON public."Notification" USING btree ("userId", read);


--
-- Name: Person_telegramId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Person_telegramId_idx" ON public."Person" USING btree ("telegramId");


--
-- Name: Person_whatsappId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Person_whatsappId_idx" ON public."Person" USING btree ("whatsappId");


--
-- Name: Person_workspaceId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Person_workspaceId_idx" ON public."Person" USING btree ("workspaceId");


--
-- Name: Project_workspaceId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Project_workspaceId_idx" ON public."Project" USING btree ("workspaceId");


--
-- Name: Project_workspaceId_status_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Project_workspaceId_status_idx" ON public."Project" USING btree ("workspaceId", status);


--
-- Name: Session_sessionToken_key; Type: INDEX; Schema: public; Owner: karol
--

CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");


--
-- Name: Task_assigneeId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Task_assigneeId_idx" ON public."Task" USING btree ("assigneeId");


--
-- Name: Task_dueDate_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Task_dueDate_idx" ON public."Task" USING btree ("dueDate");


--
-- Name: Task_projectId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Task_projectId_idx" ON public."Task" USING btree ("projectId");


--
-- Name: Task_projectId_status_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Task_projectId_status_idx" ON public."Task" USING btree ("projectId", status);


--
-- Name: Task_sourceMessageId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Task_sourceMessageId_idx" ON public."Task" USING btree ("sourceMessageId");


--
-- Name: Task_status_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Task_status_idx" ON public."Task" USING btree (status);


--
-- Name: User_email_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "User_email_idx" ON public."User" USING btree (email);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: karol
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_workspaceId_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "User_workspaceId_idx" ON public."User" USING btree ("workspaceId");


--
-- Name: VerificationToken_identifier_token_key; Type: INDEX; Schema: public; Owner: karol
--

CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON public."VerificationToken" USING btree (identifier, token);


--
-- Name: VerificationToken_token_key; Type: INDEX; Schema: public; Owner: karol
--

CREATE UNIQUE INDEX "VerificationToken_token_key" ON public."VerificationToken" USING btree (token);


--
-- Name: VoiceNote_noteId_key; Type: INDEX; Schema: public; Owner: karol
--

CREATE UNIQUE INDEX "VoiceNote_noteId_key" ON public."VoiceNote" USING btree ("noteId");


--
-- Name: Workspace_ownerId_key; Type: INDEX; Schema: public; Owner: karol
--

CREATE UNIQUE INDEX "Workspace_ownerId_key" ON public."Workspace" USING btree ("ownerId");


--
-- Name: Workspace_slug_idx; Type: INDEX; Schema: public; Owner: karol
--

CREATE INDEX "Workspace_slug_idx" ON public."Workspace" USING btree (slug);


--
-- Name: Workspace_slug_key; Type: INDEX; Schema: public; Owner: karol
--

CREATE UNIQUE INDEX "Workspace_slug_key" ON public."Workspace" USING btree (slug);


--
-- Name: Account Account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Activity Activity_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Activity"
    ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AiJob AiJob_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."AiJob"
    ADD CONSTRAINT "AiJob_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Comment Comment_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Comment Comment_noteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES public."Note"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comment Comment_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Event Event_creatorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Event Event_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Event"
    ADD CONSTRAINT "Event_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: File File_noteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."File"
    ADD CONSTRAINT "File_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES public."Note"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: File File_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."File"
    ADD CONSTRAINT "File_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public."Task"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: File File_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."File"
    ADD CONSTRAINT "File_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Integration Integration_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Integration"
    ADD CONSTRAINT "Integration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Message Message_personId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_personId_fkey" FOREIGN KEY ("personId") REFERENCES public."Person"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Message Message_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Message"
    ADD CONSTRAINT "Message_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Note Note_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Note"
    ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Note Note_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Note"
    ADD CONSTRAINT "Note_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Note Note_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Note"
    ADD CONSTRAINT "Note_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Person Person_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Person"
    ADD CONSTRAINT "Person_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Project Project_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_assigneeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Task Task_creatorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Task Task_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Task Task_sourceMessageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Task"
    ADD CONSTRAINT "Task_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES public."Message"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_workspaceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES public."Workspace"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: VoiceNote VoiceNote_noteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."VoiceNote"
    ADD CONSTRAINT "VoiceNote_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES public."Note"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Workspace Workspace_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: karol
--

ALTER TABLE ONLY public."Workspace"
    ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict U0cwySsE47f50WLVTqr355XHvrZsmLC2IP35gc5na3Go3tQgK1YEQ1jjw73fCM7

