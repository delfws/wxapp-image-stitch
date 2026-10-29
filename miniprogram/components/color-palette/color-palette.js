Component({
  properties: {
    colors: {
      type: Array,
      value: []
    },
    value: {
      type: String,
      value: "#FFFFFF"
    }
  },

  methods: {
    onTap(e) {
      const value = e.currentTarget.dataset.value;
      this.triggerEvent("change", { value });
    }
  }
});
