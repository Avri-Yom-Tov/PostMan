

const axios = require('axios');
const qs = require('qs');
const { JSDOM } = require('jsdom');
const Holidays = require('date-holidays');
const logInAndGetToken = require('./logInAndGetToken')
const readline = require('readline');



const getSessionIdInput = async (date) => {
  const params = {
    filter_day: date,
    filter_show_as_excel_pdf: '',
    filter_show_all_hidden: '0',
    orderBy: ''
  };

  try {
    const response = await fetch("https://cloud.ovdimnet.com/ws-daily.adp", {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "cookie": `ad_session_id=${process.env.AD_SESSION_ID}`,
      },
      method: "POST",
      body: new URLSearchParams(params).toString()
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const html = await response.text();
    const dom = new JSDOM(html);
    const session_id = dom.window.document.querySelector('#session_id').value;
    const sec_session_id = dom.window.document.querySelector('#sec_session_id').value;
    const firstOption = Array.from(dom.window.document.querySelectorAll('#fstjid_1 option'))
      .find(opt => opt.getAttribute('lids') && opt.getAttribute('lids').trim() !== '');


    const firstOptionLids = firstOption ? firstOption.getAttribute('lids').trim().replace(/,$/, '') : null;

    return { session_id, sec_session_id, firstOptionLids };

  } catch (error) {
    console.error('There has been a problem with your fetch operation:', error);
    throw error;
  }
};

const setWorkDayHours = async (session_id, sec_session_id, firstOptionLids, date) => {

  const data = qs.stringify({
    'session_id': session_id,
    'sec_session_id': sec_session_id,
    'wid_1': '0',
    'unique_1': '',
    'job_atype_1': '',
    'jid_1': `${firstOptionLids || '17392'} `,
    'time_start_HH_1': process.env.TIME_START_H || '09',
    'time_start_MM_1': '00',
    'time_end_HH_1': process.env.TIME_END_H || '17',
    'time_end_MM_1': '00',
    'work_hours_1': '',
    'units_1': '',
    'work_comments_1_1': '',
    'line2Handle': '1_1',
    'wid_0': '',
    'unique_0': '',
    'job_atype_0': '',
    'time_start_HH_0': '',
    'time_start_MM_0': '',
    'time_end_HH_0': '',
    'time_end_MM_0': '',
    'work_hours_0': '',
    'units_0': '',
    'work_comments_0_1': '',
    'orderBy': '',
    'orderByFlipFlag': '1',
    'filter_day': date,
    'filter_show_all_hidden': '0'
  });

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://cloud.ovdimnet.com/ws-daily.adp',
    headers: {
      "cookie": `ad_session_id=${process.env.AD_SESSION_ID}`,
    },
    data: data
  };

  try {
    await axios.request(config);

  } catch (error) {
    console.log('Error:', error);
    throw error;
  }
};

const getDaysOfMonth = (allDays = false) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const nonExcludedHolidays = filterHolidays(year);

  const days = [];
  const startDay = allDays ? 1 : today.getDate();

  for (let day = startDay; day <= lastDayOfMonth.getDate(); day++) {
    const currentDate = new Date(year, month, day);

    const isWeekend = currentDate.getDay() === 5 || currentDate.getDay() === 6;
    const isHoliday = nonExcludedHolidays.some(
      holiday => currentDate >= holiday.start && currentDate <= holiday.end
    );

    if (!isWeekend && !isHoliday) {
      let formattedDate = `${currentDate.getDate().toString().padStart(2, '0')}/${(currentDate.getMonth() + 1).toString().padStart(2, '0')}/${currentDate.getFullYear()}`;
      days.push(formattedDate);
    }
  }

  return days;
};

const filterHolidays = (year) => {
  const holidays = new Holidays('IL');
  const excludedHolidays = ['יום רבין', 'sigad', "יום העלייה", '"ט"ו בשבט"', "מימונה, שביעי של פסח", "יום הרצל", "יום הניצחון על גרמניה הנאצית", "יום ירושלים", "יום ז'בוטינסקי", '"ט"ו באב"', "יום בן-גוריון", "חנוכה", "צום עשרה בטבת"];
  const holidaysInIsrael = holidays.getHolidays(year);

  return holidaysInIsrael.filter(holiday => !excludedHolidays.includes(holiday.name))
    .map(holiday => ({
      start: new Date(holiday.start),
      end: new Date(holiday.end)
    }));
};

const printMsg = () => {
  const colorReset = '\x1b[0m';
  const bold = '\x1b[1m';
  const green = '\x1b[32m';
  const red = '\x1b[31m';

  const welcomeMessage = `${bold}Hello and welcome to the update your working hours for this month at Ravtech:${colorReset}`;
  const option1 = `${green}To update all the remaining days from 9 AM to 5 PM, excluding Weekends or Holidays or days that already set, press ${bold}1${colorReset}${green}.${colorReset}`;
  const option2 = `${green}To update all days from 9 AM to 5 PM, excluding Weekends or Holidays days that already set, press ${bold}2${colorReset}${green}.${colorReset}`;
  const option3 = `${green}To update a certain date, type the date in the following format ('DD/MM') then press enter.${colorReset}`;
  const option4 = `${red}To exit, press ${bold}0${colorReset}${red}.${colorReset}`;

  const finalMessage = `${welcomeMessage}
    - ${option1}
    - ${option2}
    - ${option3}
    ${option4}`;

  console.log(finalMessage);

}

const getUserInput = async () => {
  return new Promise((resolve) => {
    let remainingDays = [];

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.clear();
    printMsg();


    rl.on('line', (input) => {
      if (input === '1') {
        console.log('Updating remaining days for this month ...');
        remainingDays = getDaysOfMonth();
        rl.close();
      }
      else if (input === '2') {
        console.log('Updating all days for this month ...');
        remainingDays = getDaysOfMonth(true);
        rl.close();
      } else if (/^(0\d|[12]\d|3[01])\/(0\d|1[0-2])$/.test(input)) {
        const date = input + `/${new Date().getFullYear()}`;
        remainingDays.push(date);
        console.log(`Updating date: ${date}`);
        rl.close();
      } else if (input === '0') {
        console.log('Exiting...');
        rl.close();
      } else {
        console.log('Invalid input, please try again ..');
      }
    });

    rl.on('close', () => {
      resolve(remainingDays);
    });
  });
}



// Main ..
(async () => {
  try {

    const daysToUpdate = await getUserInput();
    process.env.AD_SESSION_ID = await logInAndGetToken();

    for (const date of daysToUpdate) {
      const { session_id, sec_session_id, firstOptionLids } = await getSessionIdInput(date);
      await setWorkDayHours(session_id, sec_session_id, firstOptionLids, date);
    }
    console.log(`The selected days were updated and saved in the time system ..`);

  } catch (error) {
    console.error('Error:', error);
  }
})();