import type { LegalDocumentId, LegalText } from './legal';

const CONTACT = '[TO CONFIRM: contact email address]';
const EFFECTIVE = '[TO CONFIRM: effective date]';

export const LEGAL_EN: Record<LegalDocumentId, LegalText> = {
	notice: {
		title: 'Legal notice',
		updated: EFFECTIVE,
		sections: [
			{
				heading: 'Publisher',
				paragraphs: [
					'FamiList is published by Gaëtan Compigni, a private individual acting in a non-professional capacity.',
					`Contact: ${CONTACT}.`,
					'[TO CONFIRM: postal address or registered address, only if required]'
				]
			},
			{
				heading: 'Publication director',
				paragraphs: ['Gaëtan Compigni.']
			},
			{
				heading: 'Hosting',
				items: [
					'Web application: Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, United States — vercel.com.',
					'Database, authentication and files: Supabase Inc., 970 Toa Payoh North #07-04, Singapore 318992 — supabase.com. Data is hosted in the eu-west-3 region (Paris, France).'
				]
			},
			{
				heading: 'Source code and licence',
				paragraphs: [
					'The FamiList source code is public and distributed under the GNU AGPL-3.0-or-later licence: github.com/techmefr/FamiList.'
				]
			},
			{
				heading: 'Reporting',
				paragraphs: [`To report unlawful content or a problem, write to ${CONTACT}.`]
			}
		]
	},
	terms: {
		title: 'Terms of use',
		updated: EFFECTIVE,
		sections: [
			{
				heading: 'Purpose',
				paragraphs: [
					'These terms govern the use of FamiList, an application for shared shopping lists, recipes, meal plans and loyalty cards, available at app.familiste.fr and in the mobile app. Creating an account means you accept these terms.'
				]
			},
			{
				heading: 'Account',
				items: [
					'Signing up requires a valid email address. An account may need to be approved by an administrator before it gives access to the service.',
					'You are responsible for keeping your credentials confidential. Two-factor authentication is available and recommended.',
					'You can export your data and delete your account at any time from Profile › Security.'
				]
			},
			{
				heading: 'Household, sharing and chat',
				paragraphs: [
					'A household’s lists, recipes, shops, cards and messages are visible to its members. Items you share with other people become accessible to them. You remain responsible for what you post and agree not to share anything unlawful, hateful or infringing the rights of others.'
				]
			},
			{
				heading: 'Artificial intelligence features',
				paragraphs: [
					'AI features use a provider you choose and your own API key. Your use is subject to that provider’s terms, and any costs are yours. Generated results may be inaccurate: check allergens and quantities in particular.'
				]
			},
			{
				heading: 'Loyalty cards',
				paragraphs: [
					'Only save cards and credentials that you hold or that their holder has authorised you to use.'
				]
			},
			{
				heading: 'Availability and liability',
				paragraphs: [
					'The service is provided free of charge, as is, by a private individual. No continuous availability is guaranteed. The publisher cannot be held liable for data loss or indirect damage, to the extent permitted by law.'
				]
			},
			{
				heading: 'Suspension',
				paragraphs: ['An account that breaches these terms may be suspended or deleted.']
			},
			{
				heading: 'Changes and governing law',
				paragraphs: [
					'These terms may change; the version in force is the one published on this page. They are governed by French law. In the event of a dispute, an amicable solution is sought first; failing that, the French courts have jurisdiction, subject to consumer protection rules.',
					`Contact: ${CONTACT}.`
				]
			}
		]
	},
	privacy: {
		title: 'Privacy policy',
		updated: EFFECTIVE,
		sections: [
			{
				heading: 'Data controller',
				paragraphs: [`Gaëtan Compigni, private individual. Contact: ${CONTACT}.`]
			},
			{
				heading: 'Data processed',
				items: [
					'Account: email address, display name, avatar, password (hashed by Supabase Auth), two-factor authentication factors, approval status.',
					'Content: lists and items, recipes and their photos, meal plans, shops and their location, prices, loyalty cards, household messages and polls.',
					'Household and sharing: household membership, invitations, circles, shared lists, recipes and cards.',
					'Loyalty account passwords: encrypted at rest in Supabase Vault, and optionally kept on your device, encrypted under an unlock code.',
					'AI API keys: stored for you alone, never shared with the household.',
					'Preferences: language, theme, text size, reminders.',
					'Bug reports and crash reports: description, optional screenshot, browser (user agent), app version.'
				]
			},
			{
				heading: 'Data processed on your device only',
				items: [
					'Camera: barcode scanning and magnifier; images are not uploaded.',
					'Geolocation (mobile app, with your permission): suggest the loyalty card of a nearby shop; your position is not sent to our servers.',
					'Local notifications: reminders and nearby cards, scheduled on the device.'
				]
			},
			{
				heading: 'Purposes and legal bases',
				items: [
					'Providing the service (account, sync, household, sharing, chat, cards): performance of the contract (GDPR article 6.1.b).',
					'Security, abuse prevention, account approval, two-factor authentication: legitimate interest (article 6.1.f).',
					'Diagnosing bugs and crashes: legitimate interest.',
					'AI features and images: performance of the contract, at your request.',
					'Geolocation and notifications: your consent, given through device permissions and revocable at any time.'
				]
			},
			{
				heading: 'Retention periods',
				items: [
					'Account data and content: as long as the account exists; deleted when the account is deleted.',
					'Content shared within the household: kept for the other members according to the household’s rules.',
					'Crash reports and bug reports: [TO CONFIRM: retention period for crash reports and bug reports].',
					'Hosting providers’ technical logs: according to the periods applied by Supabase and Vercel.'
				]
			},
			{
				heading: 'Recipients and processors',
				items: [
					'Supabase Inc.: database, authentication, photo storage, Vault; data hosted in Paris (eu-west-3).',
					'Vercel Inc. (United States): hosting of the web application; receives technical connection data (IP address, requests).',
					'Brevo (Sendinblue SAS, France): sending emails from noreply@familiste.fr; receives your email address.',
					'Sentry (Functional Software Inc., United States), only if the instance is configured to use it: crash reports. [TO CONFIRM: is Sentry enabled in production?]',
					'The AI provider you choose (for example Anthropic, Google, Mistral, Groq, OpenRouter, DeepSeek): receives the text of your requests, with your key, directly from your device.',
					'Pollinations and Openverse: receive a recipe’s description or name to generate or search for an image.',
					'GitHub: a bug report opens an issue that only contains its number, without personal data.'
				]
			},
			{
				heading: 'Transfers outside the European Union',
				paragraphs: [
					'Vercel and Sentry are based in the United States, as are the US AI providers. These transfers rely on the European Commission’s standard contractual clauses and, where applicable, on the EU–US Data Privacy Framework.'
				]
			},
			{
				heading: 'Your rights',
				paragraphs: [
					`You have the rights of access, rectification, erasure, restriction, portability and objection, and the right to withdraw your consent. Exporting your data and deleting your account are available in Profile › Security. For any other request, write to ${CONTACT}. You will receive an answer within one month.`,
					'You may lodge a complaint with the CNIL, the French data protection authority: www.cnil.fr, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, France.'
				]
			},
			{
				heading: 'Cookies and local storage',
				paragraphs: [
					'FamiList sets no advertising cookie and no audience-measurement tracker. The app only uses technical storage on your device: the browser’s local storage for the session and preferences, and an IndexedDB database (Dexie) for offline use. This storage is strictly necessary for the service and does not require consent.'
				]
			},
			{
				heading: 'Minors',
				paragraphs: [
					'In France, a minor under 15 cannot consent alone to the processing of their data: their account must be created with the agreement of a holder of parental authority, for example within the family household.'
				]
			},
			{
				heading: 'Security',
				paragraphs: [
					'Traffic is encrypted (HTTPS). Access to data is restricted by database-level security rules (RLS). Secrets are encrypted at rest. Two-factor authentication is available.'
				]
			},
			{
				heading: 'Changes',
				paragraphs: ['This policy may change; the version in force is the one published on this page.']
			}
		]
	},
	sales: {
		title: 'Terms of sale',
		updated: EFFECTIVE,
		sections: [
			{
				heading: 'Free service',
				paragraphs: [
					'FamiList is currently entirely free. No sale, subscription or in-app purchase is offered to date.'
				]
			},
			{
				heading: 'Future offers',
				paragraphs: [
					'The publisher reserves the right to offer paid plans in the future. Before any paid offer, complete terms of sale (prices, payment terms, right of withdrawal, warranties) will be published on this page, and no payment can be requested without your express agreement.'
				]
			},
			{
				heading: 'Contact',
				paragraphs: [`${CONTACT}.`]
			}
		]
	}
};
