# Reply templates

Copy, adjust the bracketed bits, send as plain text from the same Gmail thread.
After sending, update the lead: `pnpm lead replied <email>` (or `won` / `no`).

## The offer

| | |
|---|---|
| **Website** | $397 one-off. First 3 clients: $297 in exchange for a short testimonial |
| **Included** | One-page site based on the preview, their own photos and wording, mobile-friendly, call + email buttons, connected to their domain, basic Google setup (title, description, Google Business Profile link), 2 rounds of changes, live within 5 working days |
| **Extras** | Extra page $75. Logo, online shop and copywriting from scratch not included |
| **Care plan (optional)** | $29/month: hosting, SSL, small edits up to 30 minutes a month |
| **Payment** | 50% to start, 50% before it goes live. Wise or PayPal |
| **Domain** | Registered in their name, they pay for it (about $12/year). I can set it up |

Hosting for paying clients goes on Cloudflare Pages (free tier allows commercial use), not Vercel Hobby.

---

## "How much?"

> Hi [name],
>
> The site is $397 as a one-off. That covers the finished version of the preview with your own photos and wording, connected to your domain, plus two rounds of changes. It's live within 5 working days.
>
> You're one of my first clients in [city], so if you're happy to leave a short testimonial afterwards I'll do it for $297.
>
> If you want me to look after it afterwards (hosting, security, small edits), that's $29 a month, but it's optional.
>
> Want me to go ahead?

## "Who are you?" / "Is this a scam?"

> Fair question. I'm [your name], a web designer working remotely. I build sites for local trades and I make a free preview first so you can see exactly what you'd get before paying anything.
>
> Nothing is charged until you say yes, and the second half is only paid once you've approved the finished site.

## "Yes" / "Let's do it"

> Great. Three things to get started:
>
> 1. Send me any photos of your work you'd like on the site (phone photos are fine).
> 2. Tell me anything on the preview you'd change: wording, services, areas.
> 3. Do you already own a domain (like [business].com)? If not, I'll suggest a few.
>
> Here's the link for the 50% deposit ($[198.50 or 148.50]): [Wise/PayPal link]
>
> I'll start as soon as it comes through and send you the updated version within a few days.

## "Can we talk on the phone?"

> I'm easiest to reach by email or text since I work across time zones, and it means you get everything in writing. Happy to answer anything here. What would you like to know?

## "Not interested" / "No"

> No problem at all, thanks for letting me know. I won't email again. All the best with the business.

Then: `pnpm lead no <email>` (adds them to the do-not-email list).

## "Maybe later" / "Not right now"

> Totally understand. The preview link will stay up for a few weeks if you want to come back to it. I won't keep chasing.

## They already have a web person / site

> Makes sense. If it's ever useful, feel free to pass the preview to them as ideas. Thanks for taking a look.
