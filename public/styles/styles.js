let menu = document.querySelector('.menu_');
let toggle = document.querySelector('.toggle_');
let toggle_symbol = document.querySelector('#toggle-symbol')
toggle.addEventListener('click', () => {
  menu.classList.toggle('active');
  toggle_symbol.classList.toggle('fa-xmark');
});

// document.getElementById('myModal').addEventListener('shown.bs.modal', function () {
//   document.getElementById('myInput').focus();
// });

document.addEventListener('DOMContentLoaded', function() {
  const dropdown = document.getElementById('dropdown');
  const toggleDropdown = function() {
    document.addEventListener('click', function(e) {
      if (e.target.parentElement.classList.contains('dropdown-menu') || e.target.classList.contains('dropdown-item')) {
        return;
      }
      dropdown.classList.toggle('show');
    });
  };
  dropdown.addEventListener('shown.bs.dropdown', toggleDropdown);
});