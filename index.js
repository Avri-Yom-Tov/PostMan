

const axios = require('axios');
const qs = require('qs');
const { JSDOM } = require('jsdom');
const fs = require('fs');
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
    'time_start_HH_1': '09',
    'time_start_MM_1': '00',
    'time_end_HH_1': '17',
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
    const response = await axios.request(config);
    if (response.status) {

      return `Successfully update time for date : ${date} !`;
    }
    return 'Error';

  } catch (error) {
    console.log('Error:', error);
    throw error;
  }
};

const getRemainingDays = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const nonExcludedHolidays = filterHolidays(year);

  const remainingDays = [];

  for (let day = today.getDate(); day <= lastDayOfMonth.getDate(); day++) {
    const currentDate = new Date(year, month, day);

    const isWeekend = currentDate.getDay() === 5 || currentDate.getDay() === 6;
    const isHoliday = nonExcludedHolidays.some(holiday => currentDate >= holiday.start && currentDate <= holiday.end);

    if (!isWeekend && !isHoliday) {
      let formattedDate = `${('0' + currentDate.getDate()).slice(-2)}/${('0' + (currentDate.getMonth() + 1)).slice(-2)}/${currentDate.getFullYear()}`;
      remainingDays.push(formattedDate);
    }
  }

  return remainingDays;
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



// Function to handle user input
async function getUserInput() {
  return new Promise((resolve) => {
    let remainingDays = [];

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log(`Hello and welcome to the update of your working hours at Ravtech:
    To update all days this month from 9 am to 5 pm, excluding weekends or holidays, press 1.
    To update a certain date, type the date in the following format (for example '12/29/2023') and press enter, to exit press 0`);

    rl.on('line', (input) => {
      if (input === '1') {
        console.log('Updating all working days...');
        remainingDays = getRemainingDays();
        rl.close();
      } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(input)) {
        remainingDays.push(input);
        console.log(`Updating date: ${input}`);
        rl.close();
      } else if (input === '0') {
        console.log('Exiting...');
        rl.close();
      } else {
        console.log('Invalid input, please try again.');
      }
    });

    rl.on('close', () => {
      resolve(remainingDays);
    });
  });
}

// Main async function
(async () => {
  try {
    const remainingDays = await getUserInput();

    process.env.AD_SESSION_ID = await logInAndGetToken('208793117', 'KSyDujcEu1');
    const results = [];

    for (const date of remainingDays) {
      const { session_id, sec_session_id, firstOptionLids } = await getSessionIdInput(date);
      const result = await setWorkDayHours(session_id, sec_session_id, firstOptionLids, date);
      results.push(result);
    }

    console.log(results);
  } catch (error) {
    console.error('Error:', error);
  }
})();


const saveUserData = (data, filename) => {
  const jsonData = JSON.stringify(data);
  fs.writeFileSync(filename, jsonData, 'utf8');
}


// jid_1': '17392', Nice Developer
































const generateDataObject = () => {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // getMonth() is zero-based
  const daysInMonth = new Date(year, month, 0).getDate();

  let dataObject = {
    session_id: '1700681308114562', // assuming static
    sec_session_id: 'jwTZ/Vcoh134SsiFJwPlaWaCdg5rT1dT', // assuming static
    filter_pp: month,
    filter_pp_year: year
  };

  for (let day = 0; day <= daysInMonth; day++) {
    const dateFormatted = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dataObject[`day_${day}`] = dateFormatted;
    dataObject[`assignment_name_${day}`] = ''; // Nice |Developer
    dataObject[`jid_${day}`] = ''; // 17392
    dataObject[`job_atype_${day}`] = ''; // day in atype
    dataObject[`std_${day}`] = '28800'; // empty in 5 and 6 days  ? ..
    dataObject[`time_end_HH_${day}`] = '';
    dataObject[`time_end_MM_${day}`] = '';
    dataObject[`time_start_HH_${day}`] = '';
    dataObject[`time_start_MM_${day}`] = '';
    dataObject[`unique_${day}`] = '??';
    dataObject[`units_${day}`] = ''
    dataObject[`work_comments_${day}_1`] = '';
    dataObject[`work_hours_${day}`] = '';
    // other dynamic fields...
  }

  return dataObject;
};





