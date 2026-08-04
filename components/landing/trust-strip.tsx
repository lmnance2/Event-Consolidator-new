export function TrustStrip() {
  return (
    <section className="py-12 border-y border-border bg-muted/30" aria-label="Event sources">
      <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-6">
        Aggregating events from
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        <TicketmasterLogo />
        <EventbriteLogo />
        <MeetupLogo />
      </div>
    </section>
  );
}

function TicketmasterLogo() {
  return (
    <svg
      viewBox="0 0 200 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-7 opacity-60 hover:opacity-100 transition-opacity duration-150"
      aria-label="Ticketmaster"
      role="img"
    >
      <text
        x="0"
        y="26"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fontSize="26"
        fill="currentColor"
        letterSpacing="-0.5"
      >
        ticketmaster
      </text>
    </svg>
  );
}

function EventbriteLogo() {
  return (
    <svg
      viewBox="0 0 160 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-7 opacity-60 hover:opacity-100 transition-opacity duration-150"
      aria-label="Eventbrite"
      role="img"
    >
      <text
        x="0"
        y="26"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fontSize="26"
        fill="currentColor"
        letterSpacing="-0.5"
      >
        eventbrite
      </text>
    </svg>
  );
}

function MeetupLogo() {
  return (
    <svg
      viewBox="0 0 100 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-7 opacity-60 hover:opacity-100 transition-opacity duration-150"
      aria-label="Meetup"
      role="img"
    >
      <text
        x="0"
        y="26"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fontSize="26"
        fill="currentColor"
        letterSpacing="-0.5"
      >
        Meetup
      </text>
    </svg>
  );
}
